import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVideoDto {
  @ApiProperty({
    description: 'Titel des Videos',
    example: 'Ein Tag als Elektroniker bei Mustermann GmbH',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({
    description: 'Beschreibung des Videos',
    example: 'Begleite unseren Azubi Max durch seinen Arbeitsalltag...',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    description: 'ID der zugehörigen Stellenanzeige',
    example: 'clxx1234...',
    required: false,
  })
  @IsOptional()
  @IsString()
  jobPostId?: string;

  @ApiProperty({
    description: 'ID des zugehörigen Berufs',
    example: 'clxx5678...',
    required: false,
  })
  @IsOptional()
  @IsString()
  professionId?: string;

  @ApiProperty({
    description: 'Art des Videos',
    example: 'day_in_life',
    enum: ['day_in_life', 'azubi_interview', 'company_tour'],
    required: false,
  })
  @IsOptional()
  @IsString()
  videoType?: string;

  @ApiProperty({
    description: 'Name der vorgestellten Person',
    example: 'Max Mustermann, Azubi im 2. Lehrjahr',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  featuredPerson?: string;
}
