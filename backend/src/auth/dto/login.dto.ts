import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  /** TOTP code, required on the second step when the account has MFA enabled. */
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totp?: string;
}
