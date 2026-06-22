import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ResourceType } from '@prisma/client';

export class BulkAssignmentItemDto {
  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  crewId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  equipmentId?: string;
}

/**
 * Assign several resources (any mix of employees/crews/vehicles/equipment) to a
 * single job, all sharing one time window. Conflicts are evaluated per resource;
 * a single overrideReason (with the assignments.override permission) covers the
 * whole batch.
 */
export class CreateAssignmentsBulkDto {
  @IsUUID()
  jobId!: string;

  @IsDateString()
  startDatetime!: string;

  @IsDateString()
  endDatetime!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  plannedHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BulkAssignmentItemDto)
  items!: BulkAssignmentItemDto[];
}
