import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { RelatedEntityType } from '@prisma/client';

export class CreateDocumentDto {
  @IsEnum(RelatedEntityType)
  relatedEntityType!: RelatedEntityType;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  documentType!: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
