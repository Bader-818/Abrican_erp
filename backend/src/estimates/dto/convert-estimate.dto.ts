import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Optional extras applied to the Job created when converting an estimate. */
export class ConvertEstimateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
