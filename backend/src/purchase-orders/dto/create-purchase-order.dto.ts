import { PurchaseOrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePurchaseOrderDto {
  @IsUUID()
  clientId!: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  poNumber!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  poValue!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  expiryDate!: string;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;
}
