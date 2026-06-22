import { CrewStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CrewsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CrewStatus)
  status?: CrewStatus;
}
