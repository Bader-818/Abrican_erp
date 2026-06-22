-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('LABOR', 'VEHICLE', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'ACCOMMODATION', 'TRANSPORTATION', 'ADMIN', 'GOVERNMENT', 'FINANCE', 'OTHER_DIRECT', 'OVERHEAD');

-- CreateEnum
CREATE TYPE "ReimbursementStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'COMPENSATED', 'DELAYED', 'DECLINED');

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "vendor" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT,
    "amountBeforeVat" DECIMAL(14,2) NOT NULL,
    "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "postedAt" TIMESTAMP(3),
    "jobId" TEXT,
    "vehicleId" TEXT,
    "equipmentId" TEXT,
    "employeeId" TEXT,
    "receiptUrl" TEXT,
    "receiptName" TEXT,
    "reimbursable" BOOLEAN NOT NULL DEFAULT false,
    "reimbursementStatus" "ReimbursementStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "reimbursedAt" TIMESTAMP(3),
    "reimbursementNote" TEXT,
    "reimbursementMethod" "PaymentMethod",
    "reimbursementRef" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_jobId_idx" ON "expenses"("jobId");

-- CreateIndex
CREATE INDEX "expenses_employeeId_idx" ON "expenses"("employeeId");

-- CreateIndex
CREATE INDEX "expenses_vehicleId_idx" ON "expenses"("vehicleId");

-- CreateIndex
CREATE INDEX "expenses_equipmentId_idx" ON "expenses"("equipmentId");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_approvalStatus_idx" ON "expenses"("approvalStatus");

-- CreateIndex
CREATE INDEX "expenses_reimbursementStatus_idx" ON "expenses"("reimbursementStatus");

-- CreateIndex
CREATE INDEX "expenses_expenseDate_idx" ON "expenses"("expenseDate");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
