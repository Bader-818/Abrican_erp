import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EstimateLineDto } from './estimate-line.dto';

/**
 * Header fields are all optional. When `items` is supplied, it fully replaces
 * the estimate's line set (the totals are recomputed). Only DRAFT estimates can
 * be updated.
 */
export class UpdateEstimateDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EstimateLineDto)
  items?: EstimateLineDto[];
}
