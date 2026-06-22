import { Injectable } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { AssignmentsService } from '../assignments/assignments.service';
import { PrismaService } from '../prisma/prisma.service';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Job statuses considered "in progress" operationally.
const ACTIVE_JOB_STATUSES: JobStatus[] = [
  JobStatus.APPROVED,
  JobStatus.SCHEDULED,
  JobStatus.ACTIVE,
  JobStatus.ON_HOLD,
];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsService,
  ) {}

  async operations() {
    const now = new Date();
    const in30 = daysFromNow(30);
    const in60 = daysFromNow(60);

    const [
      jobsByStatusRaw,
      activeJobs,
      upcomingJobs,
      assignmentsByStatusRaw,
      contractsNearExpiry,
      posNearExpiry,
      recentJobs,
      utilization,
    ] = await Promise.all([
      this.prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.job.count({ where: { status: { in: ACTIVE_JOB_STATUSES } } }),
      this.prisma.job.count({
        where: { plannedStartDate: { gte: now, lte: in30 }, status: { notIn: [JobStatus.CANCELLED] } },
      }),
      this.prisma.jobAssignment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.contract.count({
        where: { status: 'ACTIVE', endDate: { gte: now, lte: in60 } },
      }),
      this.prisma.purchaseOrder.count({
        where: { status: 'ACTIVE', expiryDate: { gte: now, lte: in60 } },
      }),
      this.prisma.job.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          jobCode: true,
          title: true,
          status: true,
          plannedStartDate: true,
          client: { select: { id: true, name: true } },
        },
      }),
      // Resource load over the next two weeks (reuses the assignments engine).
      this.assignments.utilization({ from: isoDate(now), to: isoDate(daysFromNow(14)) }),
    ]);

    return {
      jobsByStatus: this.toCountMap(jobsByStatusRaw),
      activeJobs,
      upcomingJobs,
      assignmentsByStatus: this.toCountMap(assignmentsByStatusRaw),
      contractsNearExpiry,
      posNearExpiry,
      recentJobs,
      topUtilization: utilization.resources.slice(0, 5),
    };
  }

  async assets() {
    const now = new Date();

    const [
      employees,
      employeesByAvailability,
      crews,
      vehicles,
      vehiclesByStatus,
      equipment,
      equipmentByStatus,
      docTotal,
      docExpired,
      docExpiring30,
      docExpiring60,
      docExpiring90,
      docNoExpiry,
      expiringSoon,
    ] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.groupBy({ by: ['availabilityStatus'], _count: { _all: true } }),
      this.prisma.crew.count(),
      this.prisma.vehicle.count(),
      this.prisma.vehicle.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.equipment.count(),
      this.prisma.equipment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.document.count(),
      this.prisma.document.count({ where: { expiryDate: { not: null, lt: now } } }),
      this.prisma.document.count({
        where: { expiryDate: { gte: now, lte: daysFromNow(30) } },
      }),
      this.prisma.document.count({
        where: { expiryDate: { gt: daysFromNow(30), lte: daysFromNow(60) } },
      }),
      this.prisma.document.count({
        where: { expiryDate: { gt: daysFromNow(60), lte: daysFromNow(90) } },
      }),
      this.prisma.document.count({ where: { expiryDate: null } }),
      this.prisma.document.findMany({
        where: { expiryDate: { not: null, lte: daysFromNow(90) } },
        orderBy: { expiryDate: 'asc' },
        take: 10,
        select: {
          id: true,
          documentType: true,
          relatedEntityType: true,
          expiryDate: true,
          employee: { select: { name: true } },
          vehicle: { select: { plateNumber: true } },
          equipment: { select: { name: true } },
          contract: { select: { contractNumber: true } },
          client: { select: { name: true } },
        },
      }),
    ]);

    return {
      resourceCounts: { employees, crews, vehicles, equipment },
      employeesByAvailability: this.toCountMap(employeesByAvailability, 'availabilityStatus'),
      vehiclesByStatus: this.toCountMap(vehiclesByStatus),
      equipmentByStatus: this.toCountMap(equipmentByStatus),
      documentExpiry: {
        total: docTotal,
        expired: docExpired,
        expiring30: docExpiring30,
        expiring60: docExpiring60,
        expiring90: docExpiring90,
        noExpiry: docNoExpiry,
        valid:
          docTotal - docExpired - docExpiring30 - docExpiring60 - docExpiring90 - docNoExpiry,
      },
      expiringSoon: expiringSoon.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        relatedEntityType: d.relatedEntityType,
        expiryDate: d.expiryDate,
        record:
          d.employee?.name ??
          d.vehicle?.plateNumber ??
          d.equipment?.name ??
          d.contract?.contractNumber ??
          d.client?.name ??
          'Company-wide',
      })),
    };
  }

  private toCountMap<T extends Record<string, unknown>>(
    rows: T[],
    key: keyof T = 'status' as keyof T,
  ): Record<string, number> {
    const map: Record<string, number> = {};
    for (const row of rows) {
      const k = String(row[key]);
      const count = (row as { _count?: { _all?: number } })._count?._all ?? 0;
      map[k] = count;
    }
    return map;
  }
}
