import { IsEmail, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';

export class SsoRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  domain: string;

  @IsBoolean()
  @IsOptional()
  newsletterConsent?: boolean;
}
