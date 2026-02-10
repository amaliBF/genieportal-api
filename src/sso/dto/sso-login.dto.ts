import { IsEmail, IsString } from 'class-validator';

export class SsoLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  domain: string;
}
