import { JobStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class JobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsString()
  region?: string;
}
