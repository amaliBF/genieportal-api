import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @ApiProperty({ description: 'Nachrichteninhalt', example: 'Hallo, ich interessiere mich für die Ausbildung!' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Nachrichtentyp', enum: MessageType, default: MessageType.TEXT })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType = MessageType.TEXT;
}
