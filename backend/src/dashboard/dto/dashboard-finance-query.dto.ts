import { IsDateString, IsOptional } from 'class-validator';

/** Optional reporting window for the finance dashboard (defaults to the current month). */
export class DashboardFinanceQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
