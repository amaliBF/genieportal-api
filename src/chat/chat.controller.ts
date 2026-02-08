import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ═══════════════════════════════════════════════════════════════════════════
// USER CHAT ROUTES (Mobile App)
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Chats (User)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Chats des Benutzers abrufen' })
  async getUserChats(@CurrentUser('userId') userId: string) {
    return this.chatService.getUserChats(userId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Nachrichten eines Chats abrufen' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seite (Standard: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit (Standard: 50)' })
  async getMessages(
    @Param('id') chatId: string,
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getMessages(
      chatId,
      userId,
      'user',
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Nachricht senden' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  async sendMessage(
    @Param('id') chatId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      chatId,
      'user',
      userId,
      dto.content,
      dto.messageType,
    );
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat als gelesen markieren' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  async markAsRead(
    @Param('id') chatId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.markAsRead(chatId, userId, 'user');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD CHAT ROUTES (Company)
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Dashboard - Chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/chats')
export class ChatDashboardController {
  constructor(private chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Chats des Unternehmens abrufen' })
  async getCompanyChats(@CurrentUser('companyId') companyId: string) {
    return this.chatService.getCompanyChats(companyId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Nachrichten eines Chats abrufen (Dashboard)' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seite (Standard: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit (Standard: 50)' })
  async getMessages(
    @Param('id') chatId: string,
    @CurrentUser('userId') companyUserId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getMessages(
      chatId,
      companyUserId,
      'company',
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Nachricht senden (Dashboard)' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  async sendMessage(
    @Param('id') chatId: string,
    @CurrentUser('userId') companyUserId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      chatId,
      'company',
      companyUserId,
      dto.content,
      dto.messageType,
    );
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat als gelesen markieren (Dashboard)' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  async markAsRead(
    @Param('id') chatId: string,
    @CurrentUser('userId') companyUserId: string,
  ) {
    return this.chatService.markAsRead(chatId, companyUserId, 'company');
  }
}
