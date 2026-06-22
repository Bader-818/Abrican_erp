import { CrewStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCrewDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsUUID()
  supervisorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  serviceCapability?: string;

  @IsOptional()
  @IsEnum(CrewStatus)
  status?: CrewStatus;
}
