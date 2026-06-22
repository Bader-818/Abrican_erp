import { ContractStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  clientId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  contractNumber!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  scope?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  contractValue!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;
}
