import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, AuditAction, Prisma, ResourceType } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { paginate } from '../common/helpers/pagination.helper';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentsQueryDto } from './dto/assignments-query.dto';
import { CheckConflictsDto } from './dto/check-conflicts.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateAssignmentsBulkDto } from './dto/create-assignments-bulk.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { UtilizationQueryDto } from './dto/utilization-query.dto';

type ResourceIdField = 'employeeId' | 'crewId' | 'vehicleId' | 'equipmentId';

const RESOURCE_ID_FIELD: Record<ResourceType, ResourceIdField> = {
  [ResourceType.EMPLOYEE]: 'employeeId',
  [ResourceType.CREW]: 'crewId',
  [ResourceType.VEHICLE]: 'vehicleId',
  [ResourceType.EQUIPMENT]: 'equipmentId',
};

// Resource states that make a booking require an override.
const UNAVAILABLE_EMPLOYEE_STATES = ['ON_LEAVE', 'SICK', 'INACTIVE'];
const UNAVAILABLE_VEHICLE_STATES = ['MAINTENANCE', 'OUT_OF_SERVICE'];
const UNAVAILABLE_EQUIPMENT_STATES = UNAVAILABLE_VEHICLE_STATES;
const UNAVAILABLE_CREW_STATES = ['INACTIVE'];

const ASSIGNMENT_SELECT = {
  id: true,
  jobId: true,
  resourceType: true,
  startDatetime: true,
  endDatetime: true,
  plannedHours: true,
  actualHours: true,
  status: true,
  overrideReason: true,
  createdAt: true,
  updatedAt: true,
  job: { select: { id: true, jobCode: true, title: true } },
  employee: { select: { id: true, name: true, role: true, availabilityStatus: true } },
  crew: { select: { id: true, name: true, status: true } },
  vehicle: { select: { id: true, plateNumber: true, vehicleType: true, status: true } },
  equipment: { select: { id: true, name: true, equipmentType: true, status: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.JobAssignmentSelect;

export interface ConflictInfo {
  id: string;
  jobCode: string;
  jobTitle: string;
  startDatetime: Date;
  endDatetime: Date;
  status: AssignmentStatus;
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: AssignmentsQueryDto) {
    const where: Prisma.JobAssignmentWhereInput = {
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.crewId ? { crewId: query.crewId } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
      // Window overlap: assignment.start <= to AND assignment.end >= from
      ...(query.to ? { startDatetime: { lte: new Date(query.to) } } : {}),
      ...(query.from ? { endDatetime: { gte: new Date(query.from) } } : {}),
    };

    return paginate(this.prisma.jobAssignment, query, {
      where,
      orderBy: { startDatetime: 'asc' },
      select: ASSIGNMENT_SELECT,
    });
  }

  async findOne(id: string) {
    const assignment = await this.prisma.jobAssignment.findUnique({
      where: { id },
      select: ASSIGNMENT_SELECT,
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    return assignment;
  }

  /** Preview conflicts for the scheduling UI (no write). */
  async checkConflicts(dto: CheckConflictsDto): Promise<{ conflicts: ConflictInfo[] }> {
    const field = RESOURCE_ID_FIELD[dto.resourceType];
    const resourceId = this.pickResourceId(dto.resourceType, dto);
    this.validateWindow(dto.startDatetime, dto.endDatetime);

    const conflicts = await this.findConflicts(
      field,
      resourceId,
      new Date(dto.startDatetime),
      new Date(dto.endDatetime),
      dto.excludeAssignmentId,
    );
    return { conflicts };
  }

  async create(dto: CreateAssignmentDto, user: AuthenticatedUser, ipAddress?: string) {
    const field = RESOURCE_ID_FIELD[dto.resourceType];
    const resourceId = this.pickResourceId(dto.resourceType, dto);
    this.validateWindow(dto.startDatetime, dto.endDatetime);

    await this.assertJobExists(dto.jobId);
    const availabilityIssue = await this.assertResourceAndCheckAvailability(
      dto.resourceType,
      resourceId,
    );

    const start = new Date(dto.startDatetime);
    const end = new Date(dto.endDatetime);
    const conflicts = await this.findConflicts(field, resourceId, start, end);

    const overridden = this.resolveOverride(conflicts, availabilityIssue, dto.overrideReason, user);

    const created = await this.prisma.jobAssignment.create({
      data: {
        jobId: dto.jobId,
        resourceType: dto.resourceType,
        [field]: resourceId,
        startDatetime: start,
        endDatetime: end,
        plannedHours: dto.plannedHours,
        overrideReason: overridden ? dto.overrideReason : null,
        createdById: user.id,
      },
      select: ASSIGNMENT_SELECT,
    });

    await this.auditLogService.record({
      userId: user.id,
      action: overridden ? AuditAction.OVERRIDE : AuditAction.CREATE,
      entityType: 'JobAssignment',
      entityId: created.id,
      newValue: this.sanitize(created),
      ipAddress,
      comment: overridden
        ? `Booked despite ${this.describeIssues(conflicts, availabilityIssue)}. Override reason: ${dto.overrideReason}`
        : null,
    });

    return created;
  }

  /**
   * Assign multiple resources to one job in a single transaction, sharing one
   * time window. Conflicts are evaluated per resource; one overrideReason covers
   * the whole batch (and is recorded per overridden assignment).
   */
  async createMany(dto: CreateAssignmentsBulkDto, user: AuthenticatedUser, ipAddress?: string) {
    this.validateWindow(dto.startDatetime, dto.endDatetime);
    await this.assertJobExists(dto.jobId);

    const start = new Date(dto.startDatetime);
    const end = new Date(dto.endDatetime);

    // Resolve + dedupe the requested resources.
    const seen = new Set<string>();
    const resolved = dto.items.map((item) => {
      const field = RESOURCE_ID_FIELD[item.resourceType];
      const id = this.pickResourceId(item.resourceType, item);
      const key = `${field}:${id}`;
      if (seen.has(key)) {
        throw new BadRequestException('The same resource was added more than once');
      }
      seen.add(key);
      return { resourceType: item.resourceType, field, id };
    });

    // Validate existence/availability and detect conflicts for each.
    const evaluated = [];
    for (const r of resolved) {
      const availabilityIssue = await this.assertResourceAndCheckAvailability(r.resourceType, r.id);
      const conflicts = await this.findConflicts(r.field, r.id, start, end);
      evaluated.push({
        ...r,
        availabilityIssue,
        conflicts,
        blocking: conflicts.length > 0 || !!availabilityIssue,
      });
    }

    const blocking = evaluated.filter((e) => e.blocking);
    if (blocking.length > 0) {
      if (!dto.overrideReason) {
        throw new ConflictException({
          message:
            'One or more resources are unavailable for this window. Supply an overrideReason to book anyway.',
          conflicts: blocking.map((b) => ({
            resourceType: b.resourceType,
            resourceId: b.id,
            conflicts: b.conflicts,
            availabilityIssue: b.availabilityIssue,
          })),
        });
      }
      if (!user.permissions.includes('assignments.override')) {
        throw new ForbiddenException('You do not have permission to override resource conflicts');
      }
    }

    const created = await this.prisma.$transaction(
      evaluated.map((e) =>
        this.prisma.jobAssignment.create({
          data: {
            jobId: dto.jobId,
            resourceType: e.resourceType,
            [e.field]: e.id,
            startDatetime: start,
            endDatetime: end,
            plannedHours: dto.plannedHours,
            overrideReason: e.blocking ? dto.overrideReason : null,
            createdById: user.id,
          },
          select: ASSIGNMENT_SELECT,
        }),
      ),
    );

    await Promise.all(
      created.map((c, i) => {
        const e = evaluated[i];
        return this.auditLogService.record({
          userId: user.id,
          action: e.blocking ? AuditAction.OVERRIDE : AuditAction.CREATE,
          entityType: 'JobAssignment',
          entityId: c.id,
          newValue: this.sanitize(c),
          ipAddress,
          comment: e.blocking
            ? `Booked despite ${this.describeIssues(e.conflicts, e.availabilityIssue)}. Override reason: ${dto.overrideReason}`
            : null,
        });
      }),
    );

    return created;
  }

  async update(id: string, dto: UpdateAssignmentDto, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.jobAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Assignment not found');
    }

    // Resource and type are immutable after creation; only the window, hours,
    // and status can change. (Re-targeting a booking = delete + create.)
    if (
      (dto.resourceType && dto.resourceType !== existing.resourceType) ||
      (dto.jobId && dto.jobId !== existing.jobId)
    ) {
      throw new BadRequestException(
        'Cannot change the job or resource of an existing assignment; delete it and create a new one',
      );
    }

    const field = RESOURCE_ID_FIELD[existing.resourceType];
    const resourceId = existing[field]!;
    const start = dto.startDatetime ? new Date(dto.startDatetime) : existing.startDatetime;
    const end = dto.endDatetime ? new Date(dto.endDatetime) : existing.endDatetime;
    if (end <= start) {
      throw new BadRequestException('endDatetime must be after startDatetime');
    }

    let overridden = false;
    const windowChanged = !!dto.startDatetime || !!dto.endDatetime;
    if (windowChanged && dto.status !== AssignmentStatus.CANCELLED) {
      const conflicts = await this.findConflicts(field, resourceId, start, end, id);
      overridden = this.resolveOverride(conflicts, null, dto.overrideReason, user);
    }

    const updated = await this.prisma.jobAssignment.update({
      where: { id },
      data: {
        ...(dto.startDatetime ? { startDatetime: start } : {}),
        ...(dto.endDatetime ? { endDatetime: end } : {}),
        ...(dto.plannedHours !== undefined ? { plannedHours: dto.plannedHours } : {}),
        ...(dto.actualHours !== undefined ? { actualHours: dto.actualHours } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(overridden && dto.overrideReason ? { overrideReason: dto.overrideReason } : {}),
      },
      select: ASSIGNMENT_SELECT,
    });

    await this.auditLogService.record({
      userId: user.id,
      action: overridden ? AuditAction.OVERRIDE : AuditAction.UPDATE,
      entityType: 'JobAssignment',
      entityId: id,
      oldValue: this.sanitize(existing),
      newValue: this.sanitize(updated),
      ipAddress,
      comment: overridden ? `Rescheduled over a conflict. Override reason: ${dto.overrideReason}` : null,
    });

    return updated;
  }

  async remove(id: string, user: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.prisma.jobAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Assignment not found');
    }

    await this.prisma.jobAssignment.delete({ where: { id } });

    await this.auditLogService.record({
      userId: user.id,
      action: AuditAction.DELETE,
      entityType: 'JobAssignment',
      entityId: id,
      oldValue: this.sanitize(existing),
      ipAddress,
    });

    return { success: true };
  }

  /**
   * Per-resource utilization over a window: assigned hours vs. working capacity
   * (weekdays x 8h). Helps spot over/under-booked resources and conflicts.
   */
  async utilization(query: UtilizationQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to <= from) {
      throw new BadRequestException('"to" must be after "from"');
    }
    const capacityHours = this.workingCapacityHours(from, to);

    const types: ResourceType[] = query.resourceType
      ? [query.resourceType]
      : [ResourceType.EMPLOYEE, ResourceType.CREW, ResourceType.VEHICLE, ResourceType.EQUIPMENT];

    const resources: Array<{
      resourceType: ResourceType;
      resourceId: string;
      name: string;
      assignedHours: number;
      capacityHours: number;
      utilizationPct: number;
      assignmentCount: number;
    }> = [];

    for (const type of types) {
      const field = RESOURCE_ID_FIELD[type];
      const assignments = await this.prisma.jobAssignment.findMany({
        where: {
          resourceType: type,
          status: { not: AssignmentStatus.CANCELLED },
          startDatetime: { lt: to },
          endDatetime: { gt: from },
        },
        select: {
          [field]: true,
          startDatetime: true,
          endDatetime: true,
          plannedHours: true,
          employee: type === ResourceType.EMPLOYEE ? { select: { name: true } } : undefined,
          crew: type === ResourceType.CREW ? { select: { name: true } } : undefined,
          vehicle: type === ResourceType.VEHICLE ? { select: { plateNumber: true } } : undefined,
          equipment: type === ResourceType.EQUIPMENT ? { select: { name: true } } : undefined,
        },
      });

      const byResource = new Map<
        string,
        { name: string; assignedHours: number; count: number }
      >();

      for (const a of assignments as Array<Record<string, unknown>>) {
        const rid = a[field] as string | null;
        if (!rid) continue;
        const overlapHours = this.overlapHours(
          a.startDatetime as Date,
          a.endDatetime as Date,
          from,
          to,
          a.plannedHours as Prisma.Decimal | null,
        );
        const name = this.resourceName(type, a);
        const entry = byResource.get(rid) ?? { name, assignedHours: 0, count: 0 };
        entry.assignedHours += overlapHours;
        entry.count += 1;
        byResource.set(rid, entry);
      }

      for (const [resourceId, entry] of byResource) {
        resources.push({
          resourceType: type,
          resourceId,
          name: entry.name,
          assignedHours: Math.round(entry.assignedHours * 100) / 100,
          capacityHours,
          utilizationPct:
            capacityHours > 0 ? Math.round((entry.assignedHours / capacityHours) * 100) : 0,
          assignmentCount: entry.count,
        });
      }
    }

    resources.sort((a, b) => b.utilizationPct - a.utilizationPct);

    return {
      from,
      to,
      capacityHours,
      resources,
    };
  }

  // --- Helpers ----------------------------------------------------------------

  private pickResourceId(
    resourceType: ResourceType,
    dto: { employeeId?: string; crewId?: string; vehicleId?: string; equipmentId?: string },
  ): string {
    const field = RESOURCE_ID_FIELD[resourceType];
    const value = dto[field];
    if (!value) {
      throw new BadRequestException(`${field} is required when resourceType is ${resourceType}`);
    }
    // Guard against ambiguous payloads supplying ids for other resource types.
    const otherIds = (['employeeId', 'crewId', 'vehicleId', 'equipmentId'] as ResourceIdField[])
      .filter((f) => f !== field)
      .some((f) => dto[f]);
    if (otherIds) {
      throw new BadRequestException(
        `Only ${field} may be supplied when resourceType is ${resourceType}`,
      );
    }
    return value;
  }

  private validateWindow(startDatetime: string, endDatetime: string) {
    if (new Date(endDatetime) <= new Date(startDatetime)) {
      throw new BadRequestException('endDatetime must be after startDatetime');
    }
  }

  private async assertJobExists(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) {
      throw new BadRequestException('Invalid jobId');
    }
  }

  /** Returns a human label of the availability issue, or null if available. */
  private async assertResourceAndCheckAvailability(
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<string | null> {
    switch (resourceType) {
      case ResourceType.EMPLOYEE: {
        const r = await this.prisma.employee.findUnique({
          where: { id: resourceId },
          select: { availabilityStatus: true, status: true },
        });
        if (!r) throw new BadRequestException('Invalid employeeId');
        if (r.status === 'INACTIVE') return 'employee is inactive';
        if (UNAVAILABLE_EMPLOYEE_STATES.includes(r.availabilityStatus)) {
          return `employee is ${r.availabilityStatus.toLowerCase().replace('_', ' ')}`;
        }
        return null;
      }
      case ResourceType.CREW: {
        const r = await this.prisma.crew.findUnique({
          where: { id: resourceId },
          select: { status: true },
        });
        if (!r) throw new BadRequestException('Invalid crewId');
        if (UNAVAILABLE_CREW_STATES.includes(r.status)) return 'crew is inactive';
        return null;
      }
      case ResourceType.VEHICLE: {
        const r = await this.prisma.vehicle.findUnique({
          where: { id: resourceId },
          select: { status: true },
        });
        if (!r) throw new BadRequestException('Invalid vehicleId');
        if (UNAVAILABLE_VEHICLE_STATES.includes(r.status)) {
          return `vehicle is ${r.status.toLowerCase().replace('_', ' ')}`;
        }
        return null;
      }
      case ResourceType.EQUIPMENT: {
        const r = await this.prisma.equipment.findUnique({
          where: { id: resourceId },
          select: { status: true },
        });
        if (!r) throw new BadRequestException('Invalid equipmentId');
        if (UNAVAILABLE_EQUIPMENT_STATES.includes(r.status)) {
          return `equipment is ${r.status.toLowerCase().replace('_', ' ')}`;
        }
        return null;
      }
    }
  }

  private async findConflicts(
    field: ResourceIdField,
    resourceId: string,
    start: Date,
    end: Date,
    excludeAssignmentId?: string,
  ): Promise<ConflictInfo[]> {
    const rows = await this.prisma.jobAssignment.findMany({
      where: {
        [field]: resourceId,
        status: { not: AssignmentStatus.CANCELLED },
        ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
        startDatetime: { lt: end },
        endDatetime: { gt: start },
      },
      select: {
        id: true,
        startDatetime: true,
        endDatetime: true,
        status: true,
        job: { select: { jobCode: true, title: true } },
      },
      orderBy: { startDatetime: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id,
      jobCode: r.job.jobCode,
      jobTitle: r.job.title,
      startDatetime: r.startDatetime,
      endDatetime: r.endDatetime,
      status: r.status,
    }));
  }

  /**
   * Decides whether a booking that hit a conflict/availability issue may proceed.
   * Returns true if it is an authorized override; false if there was no issue.
   * Throws when blocked.
   */
  private resolveOverride(
    conflicts: ConflictInfo[],
    availabilityIssue: string | null,
    overrideReason: string | undefined,
    user: AuthenticatedUser,
  ): boolean {
    const hasIssue = conflicts.length > 0 || !!availabilityIssue;
    if (!hasIssue) {
      return false;
    }
    if (!overrideReason) {
      throw new ConflictException({
        message: `Resource is unavailable for this window (${this.describeIssues(conflicts, availabilityIssue)}). Supply an overrideReason to book anyway.`,
        conflicts,
        availabilityIssue,
      });
    }
    if (!user.permissions.includes('assignments.override')) {
      throw new ForbiddenException('You do not have permission to override resource conflicts');
    }
    return true;
  }

  private describeIssues(conflicts: ConflictInfo[], availabilityIssue: string | null): string {
    const parts: string[] = [];
    if (conflicts.length > 0) {
      parts.push(
        `${conflicts.length} overlapping assignment(s): ${conflicts.map((c) => c.jobCode).join(', ')}`,
      );
    }
    if (availabilityIssue) {
      parts.push(availabilityIssue);
    }
    return parts.join('; ');
  }

  private overlapHours(
    start: Date,
    end: Date,
    windowFrom: Date,
    windowTo: Date,
    plannedHours: Prisma.Decimal | null,
  ): number {
    const overlapStart = Math.max(start.getTime(), windowFrom.getTime());
    const overlapEnd = Math.min(end.getTime(), windowTo.getTime());
    if (overlapEnd <= overlapStart) return 0;

    const overlapMs = overlapEnd - overlapStart;
    const totalMs = end.getTime() - start.getTime();

    // Prefer the booked plannedHours, prorated to the portion inside the window.
    if (plannedHours != null && totalMs > 0) {
      return Number(plannedHours) * (overlapMs / totalMs);
    }
    return overlapMs / (1000 * 60 * 60);
  }

  /** Weekdays in [from, to) x 8 working hours. */
  private workingCapacityHours(from: Date, to: Date): number {
    let weekdays = 0;
    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    while (cursor <= last) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) weekdays += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return weekdays * 8;
  }

  private resourceName(type: ResourceType, row: Record<string, unknown>): string {
    switch (type) {
      case ResourceType.EMPLOYEE:
        return (row.employee as { name: string } | null)?.name ?? 'Unknown';
      case ResourceType.CREW:
        return (row.crew as { name: string } | null)?.name ?? 'Unknown';
      case ResourceType.VEHICLE:
        return (row.vehicle as { plateNumber: string } | null)?.plateNumber ?? 'Unknown';
      case ResourceType.EQUIPMENT:
        return (row.equipment as { name: string } | null)?.name ?? 'Unknown';
    }
  }

  private sanitize(assignment: Record<string, unknown>) {
    return {
      jobId: assignment.jobId,
      resourceType: assignment.resourceType,
      employeeId: assignment.employeeId,
      crewId: assignment.crewId,
      vehicleId: assignment.vehicleId,
      equipmentId: assignment.equipmentId,
      startDatetime: assignment.startDatetime,
      endDatetime: assignment.endDatetime,
      status: assignment.status,
    };
  }
}
