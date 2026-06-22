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

/** Only DRAFT invoices can be edited. `items` replaces the whole line set. */
export class UpdateInvoiceDto {
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  items?: InvoiceLineDto[];
}
