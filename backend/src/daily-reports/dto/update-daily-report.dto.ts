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

/** All fields optional. Editable only while DRAFT or REJECTED; jobId is immutable. */
export class UpdateDailyReportDto {
  @IsOptional()
  @IsDateString()
  reportDate?: string;

  @IsOptional()
  @IsUUID()
  supervisorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  workPerformed?: string;

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
