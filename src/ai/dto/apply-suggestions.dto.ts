import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNotEmpty } from 'class-validator';

export class ApplySuggestionsDto {
  @ApiProperty({ description: 'Konversations-ID' })
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({ description: 'Berufs-IDs zum Uebernehmen', type: [String] })
  @IsArray()
  @IsString({ each: true })
  professionIds: string[];
}
