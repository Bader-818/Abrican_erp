-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED');

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "supervisorId" TEXT,
    "workPerformed" TEXT NOT NULL,
    "progressPct" DECIMAL(5,2),
    "clientRep" TEXT,
    "weather" TEXT,
    "issues" TEXT,
    "materialsUsed" TEXT,
    "equipmentUsed" TEXT,
    "vehiclesUsed" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "employeeId" TEXT,
    "crewId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "regularHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "standbyHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "travelHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_reports_jobId_idx" ON "daily_reports"("jobId");

-- CreateIndex
CREATE INDEX "daily_reports_approvalStatus_idx" ON "daily_reports"("approvalStatus");

-- CreateIndex
CREATE INDEX "daily_reports_reportDate_idx" ON "daily_reports"("reportDate");

-- CreateIndex
CREATE INDEX "timesheets_jobId_idx" ON "timesheets"("jobId");

-- CreateIndex
CREATE INDEX "timesheets_employeeId_idx" ON "timesheets"("employeeId");

-- CreateIndex
CREATE INDEX "timesheets_crewId_idx" ON "timesheets"("crewId");

-- CreateIndex
CREATE INDEX "timesheets_approvalStatus_idx" ON "timesheets"("approvalStatus");

-- CreateIndex
CREATE INDEX "timesheets_workDate_idx" ON "timesheets"("workDate");

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "crews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
