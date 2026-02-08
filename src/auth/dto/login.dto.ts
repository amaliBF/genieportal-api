import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from './signup.dto';

export class LoginDto {
  @ApiProperty({ example: 'max@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: AccountType, default: AccountType.USER })
  @IsEnum(AccountType)
  @IsOptional()
  accountType?: AccountType = AccountType.USER;
}
