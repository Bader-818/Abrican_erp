import { OwnershipType, VehicleStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class VehiclesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional()
  @IsEnum(OwnershipType)
  ownershipType?: OwnershipType;
}
