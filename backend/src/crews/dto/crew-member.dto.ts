import { PartialType } from '@nestjs/swagger';
import { CrewMemberStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class AddCrewMemberDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateCrewMemberDto extends PartialType(AddCrewMemberDto) {
  @IsOptional()
  @IsEnum(CrewMemberStatus)
  status?: CrewMemberStatus;
}
