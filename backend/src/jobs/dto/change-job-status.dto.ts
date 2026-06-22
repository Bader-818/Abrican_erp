import { JobStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeJobStatusDto {
  @IsEnum(JobStatus)
  toStatus!: JobStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /**
   * Supplying an override reason allows bypassing the "job must have at least
   * one active assignment to go ACTIVE" rule. Requires jobs.status_override.
   */
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  overrideReason?: string;
}
