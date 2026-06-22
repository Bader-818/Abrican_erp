import { UserStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  email!: string;

  @IsStrongPassword()
  password!: string;

  @IsString()
  roleId!: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
