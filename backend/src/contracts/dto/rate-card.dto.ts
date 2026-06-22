import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRateCardDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  serviceLine!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemCode?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  unit!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  vatApplicable?: boolean;

  @IsDateString()
  effectiveDate!: string;
}

export class UpdateRateCardDto extends PartialType(CreateRateCardDto) {}
