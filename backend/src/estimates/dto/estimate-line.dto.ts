import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BillingUnit, LineKind } from '@prisma/client';

/** One billable line on an estimate: quantity × hours × unitPrice (+ VAT). */
export class EstimateLineDto {
  @IsOptional()
  @IsUUID()
  contractRateCardId?: string;

  @IsOptional()
  @IsEnum(LineKind)
  lineKind?: LineKind;

  @IsString()
  @MaxLength(300)
  description!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hours?: number;

  @IsOptional()
  @IsEnum(BillingUnit)
  unit?: BillingUnit;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  vatRate?: number;
}
