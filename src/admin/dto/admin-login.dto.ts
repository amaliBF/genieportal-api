import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@ausbildungsgenie.de' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecureAdminPass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class AdminRefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}
