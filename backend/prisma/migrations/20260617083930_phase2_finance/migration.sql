-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LineKind" AS ENUM ('LABOR', 'EQUIPMENT', 'MATERIAL', 'STANDBY', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingUnit" AS ENUM ('HOUR', 'DAY', 'TRIP', 'METER', 'UNIT', 'LUMP_SUM');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHECK', 'CASH', 'CARD', 'OTHER');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "actualCost" DECIMAL(14,2),
ADD COLUMN     "costReviewedAt" TIMESTAMP(3),
ADD COLUMN     "costReviewedById" TEXT,
ADD COLUMN     "grossMarginPct" DECIMAL(6,2),
ADD COLUMN     "grossProfit" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contractId" TEXT,
    "jobId" TEXT,
    "title" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(14,2),
    "estimatedMarginPct" DECIMAL(6,2),
    "pdfUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_line_items" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "contractRateCardId" TEXT,
    "lineKind" "LineKind" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "hours" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit" "BillingUnit" NOT NULL DEFAULT 'HOUR',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "lineSubtotal" DECIMAL(14,2) NOT NULL,
    "lineVat" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "estimatedUnitCost" DECIMAL(12,2),
    "lineCost" DECIMAL(14,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "estimate_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "estimateId" TEXT,
    "clientId" TEXT NOT NULL,
    "contractId" TEXT,
    "purchaseOrderId" TEXT,
    "jobId" TEXT,
    "clientVatNumber" TEXT,
    "billingAddress" TEXT,
    "servicePeriodFrom" TIMESTAMP(3),
    "servicePeriodTo" TIMESTAMP(3),
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "zatcaStatus" TEXT,
    "notes" TEXT,
    "pdfUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sourceEstimateLineItemId" TEXT,
    "contractRateCardId" TEXT,
    "lineKind" "LineKind" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "hours" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit" "BillingUnit" NOT NULL DEFAULT 'HOUR',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "lineSubtotal" DECIMAL(14,2) NOT NULL,
    "lineVat" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estimates_estimateNumber_key" ON "estimates"("estimateNumber");

-- CreateIndex
CREATE INDEX "estimates_clientId_idx" ON "estimates"("clientId");

-- CreateIndex
CREATE INDEX "estimates_status_idx" ON "estimates"("status");

-- CreateIndex
CREATE INDEX "estimates_jobId_idx" ON "estimates"("jobId");

-- CreateIndex
CREATE INDEX "estimate_line_items_estimateId_idx" ON "estimate_line_items"("estimateId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_uuid_key" ON "invoices"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_clientId_idx" ON "invoices"("clientId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_jobId_idx" ON "invoices"("jobId");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_clientId_idx" ON "payments"("clientId");

-- CreateIndex
CREATE INDEX "payments_paymentDate_idx" ON "payments"("paymentDate");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_costReviewedById_fkey" FOREIGN KEY ("costReviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_contractRateCardId_fkey" FOREIGN KEY ("contractRateCardId") REFERENCES "contract_rate_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_sourceEstimateLineItemId_fkey" FOREIGN KEY ("sourceEstimateLineItemId") REFERENCES "estimate_line_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_contractRateCardId_fkey" FOREIGN KEY ("contractRateCardId") REFERENCES "contract_rate_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
