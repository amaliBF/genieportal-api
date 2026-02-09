import { IsString, IsOptional, IsNumber, IsBoolean, MaxLength } from 'class-validator';

export class CreateApiJobDto {
  @IsString() @MaxLength(255)
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  requirements?: string;

  @IsOptional() @IsString()
  benefits?: string;

  @IsOptional() @IsString() @MaxLength(10)
  postalCode?: string;

  @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @IsOptional() @IsNumber()
  salaryYear1?: number;

  @IsOptional() @IsNumber()
  salaryYear2?: number;

  @IsOptional() @IsNumber()
  salaryYear3?: number;

  @IsOptional() @IsString()
  startDate?: string;

  @IsOptional() @IsNumber()
  durationMonths?: number;

  @IsOptional() @IsNumber()
  positionsAvailable?: number;

  @IsOptional() @IsBoolean()
  showOnWebsite?: boolean;

  @IsOptional() @IsString()
  status?: string;
}
