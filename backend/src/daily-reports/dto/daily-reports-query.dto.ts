import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApprovalStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class DailyReportsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsUUID()
  supervisorId?: string;

  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
