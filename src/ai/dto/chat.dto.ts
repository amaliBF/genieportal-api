import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartConversationDto {
  @ApiPropertyOptional({
    description: 'Session-ID fuer nicht-authentifizierte Nutzer',
    example: 'sess_abc123',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Portal-Kennung (z.B. werkstudentengenie, ausbildungsgenie)',
    example: 'werkstudentengenie',
  })
  @IsOptional()
  @IsString()
  portal?: string;
}

export class ChatDto {
  @ApiProperty({
    description: 'ID der Konversation',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({
    description: 'Nachricht des Nutzers',
    example: 'Ich interessiere mich fuer Technik und Computer',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ChatResponseDto {
  @ApiProperty({ description: 'ID der Konversation' })
  conversationId: string;

  @ApiProperty({
    description: 'Antwort des KI-Beraters',
    example: {
      message: 'Cool, Technik ist super! Was genau macht dir am meisten Spass?',
      quickReplies: ['Programmieren', 'Hardware basteln', 'Netzwerke', 'Gaming'],
    },
  })
  response: {
    message: string;
    quickReplies: string[];
  };

  @ApiPropertyOptional({
    description: 'Vorgeschlagene Berufe (nach 5-7 Fragen)',
    nullable: true,
  })
  suggestedProfessions: any[] | null;

  @ApiProperty({
    description: 'Ob die Beratung abgeschlossen ist',
    example: false,
  })
  isComplete: boolean;
}
