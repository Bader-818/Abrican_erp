import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AssignmentsModule } from './assignments/assignments.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ContractsModule } from './contracts/contracts.module';
import { CrewsModule } from './crews/crews.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DocumentsModule } from './documents/documents.module';
import { EmployeesModule } from './employees/employees.module';
import { EquipmentModule } from './equipment/equipment.module';
import { EstimatesModule } from './estimates/estimates.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { DailyReportsModule } from './daily-reports/daily-reports.module';
import { TimesheetsModule } from './timesheets/timesheets.module';
import { ExpensesModule } from './expenses/expenses.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { MustChangePasswordGuard } from './common/guards/must-change-password.guard';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { RolesModule } from './roles/roles.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    StorageModule,
    AuditLogModule,
    NotificationsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ClientsModule,
    ContractsModule,
    PurchaseOrdersModule,
    JobsModule,
    EmployeesModule,
    CrewsModule,
    VehiclesModule,
    EquipmentModule,
    AssignmentsModule,
    DocumentsModule,
    DashboardModule,
    EstimatesModule,
    InvoicesModule,
    PaymentsModule,
    DailyReportsModule,
    TimesheetsModule,
    ExpensesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
