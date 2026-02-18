import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @ApiProperty({ description: 'Name des Dokuments', example: 'Mein Lebenslauf' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    enum: DocumentType,
    description: 'Dokumenttyp',
    example: 'LEBENSLAUF',
  })
  @IsOptional()
  @IsEnum(DocumentType)
  dokumentTyp?: DocumentType;
}
