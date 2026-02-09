import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsBoolean,
  IsArray,
  IsNumber,
  MaxLength,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class CreateJobDto {
  @ApiProperty({ description: 'Stellentitel', example: 'Ausbildung zum Elektroniker (m/w/d)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Beruf-ID', example: 'uuid', required: false })
  @IsOptional()
  @IsString()
  professionId?: string;

  @ApiProperty({ description: 'Stellenbeschreibung', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Anforderungen', required: false })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiProperty({ description: 'Benefits / Vorteile', required: false })
  @IsOptional()
  @IsString()
  benefits?: string;

  @ApiProperty({ description: 'Startdatum (ISO 8601)', example: '2026-09-01', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Ausbildungsdauer in Monaten', example: 36, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMonths?: number;

  @ApiProperty({ description: 'Anzahl verfuegbarer Plaetze', example: 1, required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  positionsAvailable?: number;

  @ApiProperty({ description: 'Gehalt 1. Lehrjahr (EUR)', example: 1000, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryYear1?: number;

  @ApiProperty({ description: 'Gehalt 2. Lehrjahr (EUR)', example: 1100, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryYear2?: number;

  @ApiProperty({ description: 'Gehalt 3. Lehrjahr (EUR)', example: 1200, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryYear3?: number;

  @ApiProperty({ description: 'Postleitzahl', example: '10115', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @ApiProperty({ description: 'Stadt', example: 'Berlin', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ description: 'Auf Website anzeigen', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  showOnWebsite?: boolean;

  @ApiProperty({ description: 'SEO Meta-Titel (max 70 Zeichen)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @ApiProperty({ description: 'SEO Meta-Beschreibung (max 160 Zeichen)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;

  @ApiProperty({ description: 'Video-IDs zum Verknuepfen', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videoIds?: string[];

  @ApiProperty({ description: 'Portal-IDs fuer Multi-Portal-Veroeffentlichung', required: false, type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  publishedPortalIds?: number[];
}
