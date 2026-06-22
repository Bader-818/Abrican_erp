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
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  invoiceId!: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
