import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsIn,
} from 'class-validator';

export class InviteTeamMemberDto {
  @ApiProperty({ description: 'E-Mail des neuen Teammitglieds', example: 'anna@firma.de' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Vorname', example: 'Anna', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({ description: 'Nachname', example: 'Mueller', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ description: 'Rolle', example: 'member', default: 'member' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsIn(['owner', 'admin', 'member'])
  role?: string;

  @ApiProperty({ description: 'Darf Unternehmensprofil bearbeiten', default: false, required: false })
  @IsOptional()
  @IsBoolean()
  canEditProfile?: boolean;

  @ApiProperty({ description: 'Darf Stellenanzeigen verwalten', default: true, required: false })
  @IsOptional()
  @IsBoolean()
  canManageJobs?: boolean;

  @ApiProperty({ description: 'Darf chatten', default: true, required: false })
  @IsOptional()
  @IsBoolean()
  canChat?: boolean;

  @ApiProperty({ description: 'Darf Team verwalten', default: false, required: false })
  @IsOptional()
  @IsBoolean()
  canManageTeam?: boolean;

  @ApiProperty({ description: 'Darf Abrechnung verwalten', default: false, required: false })
  @IsOptional()
  @IsBoolean()
  canManageBilling?: boolean;
}
