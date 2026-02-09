import { IsEmail, IsOptional, IsString, IsInt, IsBoolean, IsEnum, IsArray, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJobAlertDto {
  @ApiProperty({ example: 'max@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Mein Alert' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Elektroniker' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  keywords?: string;

  @ApiPropertyOptional({ example: 'ausbildung' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bereich?: string;

  @ApiPropertyOptional({ example: '80331' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'München' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(200)
  radiusKm?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  remote?: boolean;

  @ApiPropertyOptional({ enum: ['INSTANT', 'DAILY', 'WEEKLY'], default: 'DAILY' })
  @IsOptional()
  @IsString()
  frequency?: string;
}
