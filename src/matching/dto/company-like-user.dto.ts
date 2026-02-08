import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompanyLikeUserDto {
  @ApiProperty({
    description: 'ID der zugehörigen Stellenanzeige',
    example: 'uuid-of-job-post',
    required: false,
  })
  @IsOptional()
  @IsString()
  jobPostId?: string;

  @ApiProperty({
    description: 'Notiz zum Kandidaten',
    example: 'Sehr guter Kandidat, passt perfekt.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
