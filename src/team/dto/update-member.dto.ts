import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsIn,
} from 'class-validator';

export class UpdateTeamMemberDto {
  @ApiProperty({ description: 'Rolle', example: 'admin', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsIn(['owner', 'admin', 'member'])
  role?: string;

  @ApiProperty({ description: 'Darf Unternehmensprofil bearbeiten', required: false })
  @IsOptional()
  @IsBoolean()
  canEditProfile?: boolean;

  @ApiProperty({ description: 'Darf Stellenanzeigen verwalten', required: false })
  @IsOptional()
  @IsBoolean()
  canManageJobs?: boolean;

  @ApiProperty({ description: 'Darf chatten', required: false })
  @IsOptional()
  @IsBoolean()
  canChat?: boolean;

  @ApiProperty({ description: 'Darf Team verwalten', required: false })
  @IsOptional()
  @IsBoolean()
  canManageTeam?: boolean;

  @ApiProperty({ description: 'Darf Abrechnung verwalten', required: false })
  @IsOptional()
  @IsBoolean()
  canManageBilling?: boolean;
}
