import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InvoiceLineDto } from './invoice-line.dto';

export class CreateInvoiceDto {
  @IsUUID()
  clientId!: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  servicePeriodFrom?: string;

  @IsOptional()
  @IsDateString()
  servicePeriodTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  items!: InvoiceLineDto[];
}
