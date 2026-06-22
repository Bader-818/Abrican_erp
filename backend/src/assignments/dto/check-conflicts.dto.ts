import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ResourceType } from '@prisma/client';

/**
 * Used by the scheduling UI to preview conflicts before submitting an
 * assignment. Mirrors the resource-selection shape of CreateAssignmentDto.
 */
export class CheckConflictsDto {
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

  /** Exclude this assignment from the check (when editing an existing one). */
  @IsOptional()
  @IsUUID()
  excludeAssignmentId?: string;
}
