import { IsString, IsInt, IsBoolean, IsOptional, IsEnum, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ example: 'company-uuid' })
  @IsString()
  companyId: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  cultureRating?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  tasksRating?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  supervisorRating?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  salaryRating?: number;

  @ApiProperty({ example: 'Tolle Ausbildung!' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Nette Kollegen, gute Betreuung' })
  @IsString()
  pros: string;

  @ApiProperty({ example: 'Wenig Gehalt im ersten Lehrjahr' })
  @IsString()
  cons: string;

  @ApiProperty({ enum: ['AZUBI', 'MITARBEITER', 'PRAKTIKANT', 'BEWERBER'] })
  @IsString()
  reviewerType: string;

  @ApiPropertyOptional({ example: 'IT-Abteilung' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  wouldRecommend?: boolean;
}
