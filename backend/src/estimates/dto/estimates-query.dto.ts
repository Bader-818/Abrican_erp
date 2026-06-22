import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstimateStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class EstimatesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsEnum(EstimateStatus)
  status?: EstimateStatus;
}
