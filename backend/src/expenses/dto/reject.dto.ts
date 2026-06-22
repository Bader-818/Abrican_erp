import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
