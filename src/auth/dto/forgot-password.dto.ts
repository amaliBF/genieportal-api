import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from './signup.dto';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'max@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: AccountType, default: AccountType.USER })
  @IsEnum(AccountType)
  @IsOptional()
  accountType?: AccountType = AccountType.USER;
}
