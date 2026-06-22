import { EquipmentStatus, OwnershipType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class EquipmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @IsOptional()
  @IsEnum(OwnershipType)
  ownershipType?: OwnershipType;
}
