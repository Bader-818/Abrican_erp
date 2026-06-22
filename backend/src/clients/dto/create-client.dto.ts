import { ClientStatus, ClientType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsEnum(ClientType)
  clientType!: ClientType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vatNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  crNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  billingAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
