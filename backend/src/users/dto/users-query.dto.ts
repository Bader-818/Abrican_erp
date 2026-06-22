import { UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class UsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
