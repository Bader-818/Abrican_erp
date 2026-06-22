import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AuditAction } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AuditLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  userId?: string;
}
