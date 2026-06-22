import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Metadata-only update. The file itself and the related entity are immutable
 * after upload (re-upload = delete + create).
 */
export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  documentType?: string;

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
