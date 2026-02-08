import { IsString, MinLength, MaxLength, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'NewSecurePass123!' })
  @IsString()
  @MinLength(8, { message: 'Passwort muss mindestens 8 Zeichen lang sein' })
  @MaxLength(128)
  @Matches(/[A-Z]/, {
    message: 'Passwort muss mindestens einen Großbuchstaben enthalten',
  })
  @Matches(/[0-9]/, {
    message: 'Passwort muss mindestens eine Zahl enthalten',
  })
  newPassword: string;
}
