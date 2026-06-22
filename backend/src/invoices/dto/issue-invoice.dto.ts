import { IsOptional, IsString, MaxLength } from 'class-validator';

export class IssueInvoiceDto {
  /**
   * Required to issue an invoice that exceeds the linked PO's remaining balance.
   * Recorded as an OVERRIDE in the audit log.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}
