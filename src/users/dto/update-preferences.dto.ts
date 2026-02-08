import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsString,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class UpdatePreferencesDto {
  @ApiProperty({
    description: 'Bevorzugte Berufe (IDs)',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredProfessions?: string[];

  @ApiProperty({ description: 'Maximale Entfernung in km', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxDistanceKm?: number;

  @ApiProperty({
    description: 'Gewuenschter Ausbildungsstart (ISO 8601)',
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

  @ApiProperty({ description: 'Profil sichtbar fuer Betriebe', required: false })
  @IsOptional()
  @IsBoolean()
  profileVisible?: boolean;
}
