import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AccountType {
  USER = 'user',
  COMPANY = 'company',
}

export class SignupDto {
  @ApiProperty({ example: 'max@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8, { message: 'Passwort muss mindestens 8 Zeichen lang sein' })
  @MaxLength(128)
  @Matches(/[A-Z]/, {
    message: 'Passwort muss mindestens einen Großbuchstaben enthalten',
  })
  @Matches(/[0-9]/, {
    message: 'Passwort muss mindestens eine Zahl enthalten',
  })
  password: string;

  @ApiProperty({ example: 'Max' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Mustermann', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ enum: AccountType, default: AccountType.USER })
  @IsEnum(AccountType)
  @IsOptional()
  accountType?: AccountType = AccountType.USER;

  // Company-specific fields
  @ApiProperty({ required: false, example: 'Elektro Müller GmbH' })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({ required: false, example: '86150' })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiProperty({ required: false, example: 'Augsburg' })
  @IsString()
  @IsOptional()
  city?: string;
}
