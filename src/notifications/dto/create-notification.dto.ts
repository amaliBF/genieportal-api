import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @ApiPropertyOptional({ description: 'Benutzer-ID (fuer User-Benachrichtigungen)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'CompanyUser-ID (fuer Dashboard-Benachrichtigungen)' })
  @IsOptional()
  @IsString()
  companyUserId?: string;

  @ApiProperty({ enum: NotificationType, description: 'Typ der Benachrichtigung' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Titel der Benachrichtigung', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Inhalt der Benachrichtigung' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'Referenz-Typ (z.B. match, message, job)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Referenz-ID' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}
