import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsStrongPassword()
  newPassword!: string;
}
