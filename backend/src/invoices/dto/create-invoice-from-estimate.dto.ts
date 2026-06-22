import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Seed an invoice from an approved/converted estimate. The estimate's line items
 * are copied as the starting (editable) quantities — the coordinator then trims
 * them to the actual quantities delivered before issuing.
 */
export class CreateInvoiceFromEstimateDto {
  @IsUUID()
  estimateId!: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
