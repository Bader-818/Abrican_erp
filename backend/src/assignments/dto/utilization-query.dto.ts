import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ResourceType } from '@prisma/client';

export class UtilizationQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  /** Limit the report to a single resource category. */
  @IsOptional()
  @IsEnum(ResourceType)
  resourceType?: ResourceType;
}
