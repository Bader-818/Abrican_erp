import { ClientStatus, ClientType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ClientsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ClientType)
  clientType?: ClientType;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;
}
