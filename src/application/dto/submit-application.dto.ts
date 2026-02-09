import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber, MaxLength } from 'class-validator';

export class SubmitApplicationDto {
  @IsString() @MaxLength(100)
  firstName: string;

  @IsString() @MaxLength(100)
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsString()
  birthDate?: string;

  @IsOptional() @IsString() @MaxLength(10)
  postalCode?: string;

  @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  message?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  anschreiben?: string;

  @IsOptional() @IsString() @MaxLength(100)
  schulabschluss?: string;

  @IsOptional() @IsNumber()
  abschlussjahr?: number;

  @IsOptional() @IsString()
  sourceChannel?: string;

  @IsBoolean()
  datenschutzAkzeptiert: boolean;

  @IsOptional() @IsBoolean()
  newsletterOptIn?: boolean;
}
