import { IsDateString, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentMethod, ReimbursementStatus } from '@prisma/client';

/** The actionable reimbursement outcomes a manager can set on an approved expense. */
export const REIMBURSEMENT_ACTIONS = [
  ReimbursementStatus.COMPENSATED,
  ReimbursementStatus.DELAYED,
  ReimbursementStatus.DECLINED,
] as const;

export class ReimburseDto {
  @IsIn(REIMBURSEMENT_ACTIONS as unknown as ReimbursementStatus[])
  status!: ReimbursementStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
