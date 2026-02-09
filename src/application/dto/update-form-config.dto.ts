import { IsArray, IsOptional, IsBoolean, IsString } from 'class-validator';

export class UpdateFormConfigDto {
  @IsOptional() @IsArray()
  activeFields?: string[];

  @IsOptional() @IsArray()
  requiredFields?: string[];

  @IsOptional() @IsArray()
  customFields?: any[];

  @IsOptional() @IsBoolean()
  allowAppApplication?: boolean;

  @IsOptional() @IsBoolean()
  allowWebsiteApplication?: boolean;

  @IsOptional() @IsString()
  externalApplicationUrl?: string;
}
