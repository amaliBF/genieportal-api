import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from './ai.service';
import { StartConversationDto, ChatDto, ChatResponseDto } from './dto/chat.dto';
import { ApplySuggestionsDto } from './dto/apply-suggestions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * OptionalJwtGuard: Validates JWT if present but does NOT reject unauthenticated requests.
 * This allows both logged-in and guest users to use the Berufsfinder.
 */
class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // If there's no user or an error, just return null instead of throwing
    return user || null;
  }
}

@ApiTags('AI Berufsfinder')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // ─── START NEW CONVERSATION ─────────────────────────────────────────────────

  @Post('conversation/new')
  @UseGuards(OptionalJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Neue Berufsfinder-Konversation starten',
    description:
      'Startet eine neue KI-Beratung. Funktioniert sowohl fuer eingeloggte als auch fuer Gast-Nutzer.',
  })
  @ApiResponse({ status: 201, description: 'Konversation erfolgreich gestartet', type: ChatResponseDto })
  async startConversation(
    @Body() dto: StartConversationDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || undefined;
    return this.aiService.startConversation(userId, dto.sessionId);
  }

  // ─── CHAT ───────────────────────────────────────────────────────────────────

  @Post('chat')
  @UseGuards(OptionalJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Nachricht an den KI-Berater senden',
    description:
      'Sendet eine Nachricht an den KI-Berufsfinder und erhaelt eine Antwort mit Quick-Reply-Optionen.',
  })
  @ApiResponse({ status: 201, description: 'Antwort vom KI-Berater', type: ChatResponseDto })
  async chat(@Body() dto: ChatDto, @Req() req: any) {
    const userId = req.user?.sub || undefined;
    return this.aiService.chat(dto.conversationId, dto.message, userId);
  }

  // ─── GET CONVERSATION ───────────────────────────────────────────────────────

  @Get('conversation/:id')
  @UseGuards(OptionalJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Konversation abrufen',
    description: 'Ruft eine bestehende Berufsfinder-Konversation mit allen Nachrichten ab.',
  })
  @ApiParam({ name: 'id', description: 'Konversations-ID (UUID)' })
  async getConversation(@Param('id') id: string) {
    return this.aiService.getConversation(id);
  }

  // ─── APPLY SUGGESTIONS ────────────────────────────────────────────────────

  @Post('apply-suggestions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'KI-Berufsvorschlaege in Profil uebernehmen',
    description:
      'Uebernimmt die vom KI-Berater vorgeschlagenen Berufe in die bevorzugten Berufe des Nutzers.',
  })
  @ApiResponse({ status: 201, description: 'Vorschlaege erfolgreich uebernommen' })
  async applySuggestions(
    @Body() dto: ApplySuggestionsDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenException('Authentifizierung erforderlich');
    }
    return this.aiService.applySuggestions(
      userId,
      dto.conversationId,
      dto.professionIds,
    );
  }
}
