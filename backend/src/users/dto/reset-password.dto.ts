import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class ResetPasswordDto {
  @IsStrongPassword()
  newPassword!: string;
}
