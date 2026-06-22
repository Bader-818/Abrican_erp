import { EquipmentStatus, OwnershipType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEquipmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  equipmentType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @IsEnum(OwnershipType)
  ownershipType!: OwnershipType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentLocation?: string;

  @IsOptional()
  @IsDateString()
  calibrationExpiry?: string;

  @IsOptional()
  @IsDateString()
  maintenanceDueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
