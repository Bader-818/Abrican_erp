import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { RelatedEntityType } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class DocumentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RelatedEntityType)
  relatedEntityType?: RelatedEntityType;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  /** Only documents that expire within this many days (also includes already expired). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expiringWithinDays?: number;

  /** Only documents whose expiryDate is already in the past. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  expired?: boolean;
}
