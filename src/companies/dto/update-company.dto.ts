import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCompanyDto {
  @ApiProperty({ description: 'Firmenname', example: 'Mustermann GmbH', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ description: 'Rechtlicher Firmenname', example: 'Mustermann GmbH & Co. KG', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @ApiProperty({ description: 'Telefonnummer', example: '+49 30 123456', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ description: 'Website', example: 'https://www.mustermann.de', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @ApiProperty({ description: 'Straße', example: 'Musterstraße 1', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

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

  @ApiProperty({ description: 'Branche', example: 'Handwerk', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiProperty({ description: 'Branchen-Tags', example: ['Elektro', 'Installation'], required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industryTags?: string[];

  @ApiProperty({ description: 'Beschreibung', example: 'Wir sind ein traditionsreiches Unternehmen...', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Kurzbeschreibung', example: 'Traditionsreiches Handwerksunternehmen in Berlin', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @ApiProperty({ description: 'Gründungsjahr', example: 1995, required: false })
  @IsOptional()
  @IsInt()
  @Min(1800)
  foundedYear?: number;

  @ApiProperty({ description: 'Mitarbeiteranzahl (Bereich)', example: '50-100', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  employeeCount?: string;

  @ApiProperty({ description: 'Bildet aus seit (Jahr)', example: 2005, required: false })
  @IsOptional()
  @IsInt()
  @Min(1800)
  trainingSince?: number;

  @ApiProperty({ description: 'Anzahl Auszubildende gesamt', example: 12, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalApprentices?: number;

  @ApiProperty({ description: 'Benefits / Vorteile', example: ['Jobticket', 'Kantine', 'Flexible Arbeitszeiten'], required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];
}
