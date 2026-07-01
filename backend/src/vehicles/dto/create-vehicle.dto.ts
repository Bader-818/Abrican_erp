import { OwnershipType, VehicleClass, VehicleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  plateNumber!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  vehicleType!: string;

  @IsOptional()
  @IsEnum(VehicleClass)
  vehicleClass?: VehicleClass;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  doorNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  plateNumberAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  plateColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  make?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  year?: number;

  @IsEnum(OwnershipType)
  ownershipType!: OwnershipType;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometer?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  fuelType?: string;

  @IsOptional()
  @IsDateString()
  registrationExpiry?: string;

  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @IsOptional()
  @IsDateString()
  inspectionExpiry?: string;

  @IsOptional()
  @IsDateString()
  operatingCardExpiry?: string;

  @IsOptional()
  @IsDateString()
  aramcoStickerExpiry?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
