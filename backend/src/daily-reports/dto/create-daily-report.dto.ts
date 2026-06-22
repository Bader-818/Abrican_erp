import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDailyReportDto {
  @IsUUID()
  jobId!: string;

  @IsDateString()
  reportDate!: string;

  @IsOptional()
  @IsUUID()
  supervisorId?: string;

  @IsString()
  @MaxLength(5000)
  workPerformed!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  progressPct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientRep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  weather?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  issues?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  materialsUsed?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  equipmentUsed?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  vehiclesUsed?: string;
}
