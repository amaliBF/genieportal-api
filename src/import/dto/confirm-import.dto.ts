import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class ConfirmImportDto {
  @IsObject()
  columnMapping: Record<string, string>;

  @IsString()
  mode: 'ADD' | 'UPDATE' | 'REPLACE';

  @IsOptional()
  @IsBoolean()
  publishImmediately?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnWebsite?: boolean;
}
