import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsArray,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ description: 'Vorname', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({ description: 'Nachname', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ description: 'Anzeigename', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiProperty({ description: 'Telefonnummer', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ description: 'Geburtsdatum (ISO 8601)', required: false })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ description: 'Postleitzahl', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @ApiProperty({ description: 'Stadt', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ description: 'Über mich', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiProperty({
    description: 'Interessen',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiProperty({
    description: 'Stärken',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  strengths?: string[];

  @ApiProperty({ description: 'Wonach ich suche', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lookingFor?: string;

  @ApiProperty({ description: 'Aktuelle Schulform', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  currentSchoolType?: string;

  @ApiProperty({ description: 'Abschlussjahr', required: false })
  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2040)
  graduationYear?: number;

  @ApiProperty({ description: 'Maximale Entfernung in km', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxDistanceKm?: number;

  @ApiProperty({
    description: 'Gewünschter Ausbildungsstart (ISO 8601)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  preferredStartDate?: string;

  @ApiProperty({ description: 'Push-Benachrichtigungen aktiviert', required: false })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiProperty({ description: 'E-Mail-Benachrichtigungen aktiviert', required: false })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiProperty({ description: 'Profil sichtbar', required: false })
  @IsOptional()
  @IsBoolean()
  profileVisible?: boolean;
}
