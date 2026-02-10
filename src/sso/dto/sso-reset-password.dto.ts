import { IsString, MinLength } from 'class-validator';

export class SsoForgotPasswordDto {
  @IsString()
  email: string;
}

export class SsoResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
