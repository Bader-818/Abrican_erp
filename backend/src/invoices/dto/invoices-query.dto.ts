import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class InvoicesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  /** Only invoices past their due date with an outstanding balance. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdue?: boolean;
}
