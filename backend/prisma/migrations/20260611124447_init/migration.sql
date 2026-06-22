-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('GOVERNMENT', 'SEMI_GOVERNMENT', 'PRIVATE', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'CLOSED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PLANNED', 'APPROVED', 'SCHEDULED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'COSTING_REVIEW', 'READY_FOR_INVOICE', 'INVOICED', 'PARTIALLY_PAID', 'PAID', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'ON_LEAVE', 'SICK', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CrewStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CrewMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('OWNED', 'LEASED', 'RENTED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('EMPLOYEE', 'CREW', 'VEHICLE', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RelatedEntityType" AS ENUM ('EMPLOYEE', 'VEHICLE', 'EQUIPMENT', 'CONTRACT', 'CLIENT', 'COMPANY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('JOB_ASSIGNED', 'RESOURCE_CONFLICT', 'DOCUMENT_EXPIRING', 'DOCUMENT_EXPIRED', 'CONTRACT_NEAR_EXPIRY', 'PO_NEAR_EXPIRY', 'JOB_STATUS_CHANGED', 'GENERAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'STATUS_CHANGE', 'OVERRIDE', 'APPROVE', 'REJECT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientType" "ClientType" NOT NULL,
    "vatNumber" TEXT,
    "crNumber" TEXT,
    "billingAddress" TEXT,
    "paymentTermsDays" INTEGER,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "contractValue" DECIMAL(14,2) NOT NULL,
    "consumedValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentTermsDays" INTEGER,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_rate_cards" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "serviceLine" TEXT NOT NULL,
    "itemCode" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "vatApplicable" BOOLEAN NOT NULL DEFAULT true,
    "effectiveDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contractId" TEXT,
    "poNumber" TEXT NOT NULL,
    "poValue" DECIMAL(14,2) NOT NULL,
    "consumedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "jobCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contractId" TEXT,
    "purchaseOrderId" TEXT,
    "serviceType" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "region" TEXT,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3) NOT NULL,
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "jobValue" DECIMAL(14,2),
    "costBudget" DECIMAL(14,2),
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_status_history" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromStatus" "JobStatus",
    "toStatus" "JobStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT,
    "costRate" DECIMAL(10,2),
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "phone" TEXT,
    "email" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crews" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supervisorId" TEXT,
    "serviceCapability" TEXT,
    "status" "CrewStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_members" (
    "id" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "CrewMemberStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "crew_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "ownershipType" "OwnershipType" NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "odometer" INTEGER,
    "fuelType" TEXT,
    "registrationExpiry" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "inspectionExpiry" TIMESTAMP(3),
    "costRate" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "serialNumber" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "ownershipType" "OwnershipType" NOT NULL,
    "costRate" DECIMAL(10,2),
    "currentLocation" TEXT,
    "calibrationExpiry" TIMESTAMP(3),
    "maintenanceDueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_assignments" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "employeeId" TEXT,
    "crewId" TEXT,
    "vehicleId" TEXT,
    "equipmentId" TEXT,
    "startDatetime" TIMESTAMP(3) NOT NULL,
    "endDatetime" TIMESTAMP(3) NOT NULL,
    "plannedHours" DECIMAL(8,2),
    "actualHours" DECIMAL(8,2),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PLANNED',
    "overrideReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "relatedEntityType" "RelatedEntityType" NOT NULL,
    "employeeId" TEXT,
    "vehicleId" TEXT,
    "equipmentId" TEXT,
    "contractId" TEXT,
    "clientId" TEXT,
    "documentType" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fileUrl" TEXT NOT NULL,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_clientType_idx" ON "clients"("clientType");

-- CreateIndex
CREATE INDEX "client_contacts_clientId_idx" ON "client_contacts"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contractNumber_key" ON "contracts"("contractNumber");

-- CreateIndex
CREATE INDEX "contracts_clientId_idx" ON "contracts"("clientId");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_endDate_idx" ON "contracts"("endDate");

-- CreateIndex
CREATE INDEX "contract_rate_cards_contractId_idx" ON "contract_rate_cards"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_clientId_idx" ON "purchase_orders"("clientId");

-- CreateIndex
CREATE INDEX "purchase_orders_contractId_idx" ON "purchase_orders"("contractId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_expiryDate_idx" ON "purchase_orders"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_jobCode_key" ON "jobs"("jobCode");

-- CreateIndex
CREATE INDEX "jobs_clientId_idx" ON "jobs"("clientId");

-- CreateIndex
CREATE INDEX "jobs_contractId_idx" ON "jobs"("contractId");

-- CreateIndex
CREATE INDEX "jobs_purchaseOrderId_idx" ON "jobs"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_serviceType_idx" ON "jobs"("serviceType");

-- CreateIndex
CREATE INDEX "jobs_region_idx" ON "jobs"("region");

-- CreateIndex
CREATE INDEX "job_status_history_jobId_idx" ON "job_status_history"("jobId");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "employees_availabilityStatus_idx" ON "employees"("availabilityStatus");

-- CreateIndex
CREATE INDEX "crews_supervisorId_idx" ON "crews"("supervisorId");

-- CreateIndex
CREATE INDEX "crews_status_idx" ON "crews"("status");

-- CreateIndex
CREATE INDEX "crew_members_crewId_idx" ON "crew_members"("crewId");

-- CreateIndex
CREATE INDEX "crew_members_employeeId_idx" ON "crew_members"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plateNumber_key" ON "vehicles"("plateNumber");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "job_assignments_jobId_idx" ON "job_assignments"("jobId");

-- CreateIndex
CREATE INDEX "job_assignments_employeeId_idx" ON "job_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "job_assignments_crewId_idx" ON "job_assignments"("crewId");

-- CreateIndex
CREATE INDEX "job_assignments_vehicleId_idx" ON "job_assignments"("vehicleId");

-- CreateIndex
CREATE INDEX "job_assignments_equipmentId_idx" ON "job_assignments"("equipmentId");

-- CreateIndex
CREATE INDEX "job_assignments_status_idx" ON "job_assignments"("status");

-- CreateIndex
CREATE INDEX "job_assignments_startDatetime_endDatetime_idx" ON "job_assignments"("startDatetime", "endDatetime");

-- CreateIndex
CREATE INDEX "documents_relatedEntityType_idx" ON "documents"("relatedEntityType");

-- CreateIndex
CREATE INDEX "documents_employeeId_idx" ON "documents"("employeeId");

-- CreateIndex
CREATE INDEX "documents_vehicleId_idx" ON "documents"("vehicleId");

-- CreateIndex
CREATE INDEX "documents_equipmentId_idx" ON "documents"("equipmentId");

-- CreateIndex
CREATE INDEX "documents_contractId_idx" ON "documents"("contractId");

-- CreateIndex
CREATE INDEX "documents_clientId_idx" ON "documents"("clientId");

-- CreateIndex
CREATE INDEX "documents_expiryDate_idx" ON "documents"("expiryDate");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_rate_cards" ADD CONSTRAINT "contract_rate_cards_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_status_history" ADD CONSTRAINT "job_status_history_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_status_history" ADD CONSTRAINT "job_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crews" ADD CONSTRAINT "crews_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "crews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
