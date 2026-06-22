import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class PaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}
