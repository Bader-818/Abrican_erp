import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ResourceType } from '@prisma/client';

export class CreateAssignmentDto {
  @IsUUID()
  jobId!: string;

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

  @IsDateString()
  startDatetime!: string;

  @IsDateString()
  endDatetime!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  plannedHours?: number;

  /**
   * When supplied, the caller asks to book this resource despite a detected
   * conflict or unavailability. Requires the `assignments.override` permission;
   * the override is recorded in the audit log.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}
