import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AssignmentStatus, ResourceType } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AssignmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsEnum(ResourceType)
  resourceType?: ResourceType;

  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

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

  /** Inclusive lower bound: return assignments whose window ends on/after this. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Inclusive upper bound: return assignments whose window starts on/before this. */
  @IsOptional()
  @IsDateString()
  to?: string;
}
