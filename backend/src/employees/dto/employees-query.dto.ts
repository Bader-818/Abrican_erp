import { AvailabilityStatus, EmployeeStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class EmployeesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;
}
