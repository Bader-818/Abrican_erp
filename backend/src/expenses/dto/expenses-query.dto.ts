import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApprovalStatus, ExpenseCategory, ReimbursementStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ExpensesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @IsOptional()
  @IsEnum(ReimbursementStatus)
  reimbursementStatus?: ReimbursementStatus;

  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
