import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { ExpenseCategory } from '@prisma/client';

export class CreateExpenseDto {
  @IsDateString()
  expenseDate!: string;

  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountBeforeVat!: number;

  /** Optional — defaults to 15% of amountBeforeVat when omitted. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  vatAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  // Allocation — all optional.
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  /** When true, this is an employee out-of-pocket cost that enters the reimbursement track. */
  @IsOptional()
  @IsBoolean()
  reimbursable?: boolean;
}
