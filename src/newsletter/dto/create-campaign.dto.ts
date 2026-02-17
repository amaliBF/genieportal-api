import { IsString, IsOptional, IsArray, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Die Genie App ist da!' })
  @IsString()
  @MaxLength(500)
  subject: string;

  @ApiProperty({ example: '<h1>Hallo!</h1><p>Die App ist jetzt verfügbar.</p>' })
  @IsString()
  htmlContent: string;

  @ApiPropertyOptional({ example: ['werkstudentengenie.de', 'berufsgenie.de'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetDomains?: string[];
}

export class UpdateCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetDomains?: string[];
}
