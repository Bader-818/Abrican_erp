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

export class CreateEstimateDto {
  @IsUUID()
  clientId!: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(120)
  jobType!: string;

  @IsString()
  @MaxLength(200)
  location!: string;

  @IsDateString()
  plannedStartDate!: string;

  @IsDateString()
  plannedEndDate!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EstimateLineDto)
  items!: EstimateLineDto[];
}
