import { IsString, IsArray, IsUrl, IsOptional } from 'class-validator';

export class CreateWebhookDto {
  @IsUrl()
  url: string;

  @IsArray()
  events: string[];
}

export class UpdateWebhookDto {
  @IsOptional() @IsUrl()
  url?: string;

  @IsOptional() @IsArray()
  events?: string[];

  @IsOptional()
  isActive?: boolean;
}
