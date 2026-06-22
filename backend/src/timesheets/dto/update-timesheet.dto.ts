import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** All fields optional. Editable only while DRAFT or REJECTED; job/resource are immutable. */
export class UpdateTimesheetDto {
  @IsOptional()
  @IsDateString()
  workDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  regularHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  overtimeHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  standbyHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  travelHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
