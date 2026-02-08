import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LikeCompanyDto {
  @ApiProperty({
    description: 'Quelle des Likes (z.B. feed, profile, search)',
    example: 'feed',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;
}
