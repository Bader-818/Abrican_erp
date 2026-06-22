import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { AssignmentStatus } from '@prisma/client';
import { CreateAssignmentDto } from './create-assignment.dto';

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) {
  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  actualHours?: number;
}
