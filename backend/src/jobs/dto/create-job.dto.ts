import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsUUID()
  clientId!: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  serviceType!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  location!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsDateString()
  plannedStartDate!: string;

  @IsDateString()
  plannedEndDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  jobValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costBudget?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
