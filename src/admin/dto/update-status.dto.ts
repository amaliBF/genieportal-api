import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AdminUserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BANNED = 'BANNED',
  DELETED = 'DELETED',
}

export enum AdminCompanyStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export enum AdminVideoStatus {
  PROCESSING = 'PROCESSING',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  DELETED = 'DELETED',
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: AdminUserStatus, example: 'BANNED' })
  @IsEnum(AdminUserStatus)
  status: AdminUserStatus;
}

export class UpdateCompanyStatusDto {
  @ApiProperty({ enum: AdminCompanyStatus, example: 'ACTIVE' })
  @IsEnum(AdminCompanyStatus)
  status: AdminCompanyStatus;
}

export class UpdateVideoStatusDto {
  @ApiProperty({ enum: AdminVideoStatus, example: 'ACTIVE' })
  @IsEnum(AdminVideoStatus)
  status: AdminVideoStatus;

  @ApiPropertyOptional({ example: 'Video contains inappropriate content' })
  @IsString()
  @IsOptional()
  moderationNote?: string;
}

export class CreateAdminDto {
  @ApiProperty({ example: 'newadmin@ausbildungsgenie.de' })
  @IsString()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'Max Mustermann' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'support', default: 'support' })
  @IsString()
  @IsOptional()
  role?: string;
}
