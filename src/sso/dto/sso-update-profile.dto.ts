import { IsString, IsOptional, IsArray } from 'class-validator';

export class SsoUpdateProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  lifePhase?: string;

  @IsArray()
  @IsOptional()
  interests?: string[];
}
