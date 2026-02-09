import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SocialService } from './social.service';

@ApiTags('Social & Community')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('api/user')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  // ─── Freunde ─────────────────────────────────────────────────────────────────

  @Post('friends/request/:receiverId')
  @ApiOperation({ summary: 'Freundschaftsanfrage senden' })
  sendRequest(@CurrentUser('id') userId: string, @Param('receiverId') receiverId: string) {
    return this.socialService.sendFriendRequest(userId, receiverId);
  }

  @Post('friends/:friendshipId/accept')
  @ApiOperation({ summary: 'Freundschaftsanfrage annehmen' })
  acceptRequest(@CurrentUser('id') userId: string, @Param('friendshipId') id: string) {
    return this.socialService.acceptFriendRequest(userId, id);
  }

  @Post('friends/:friendshipId/decline')
  @ApiOperation({ summary: 'Freundschaftsanfrage ablehnen' })
  declineRequest(@CurrentUser('id') userId: string, @Param('friendshipId') id: string) {
    return this.socialService.declineFriendRequest(userId, id);
  }

  @Delete('friends/:friendshipId')
  @ApiOperation({ summary: 'Freundschaft entfernen' })
  removeFriend(@CurrentUser('id') userId: string, @Param('friendshipId') id: string) {
    return this.socialService.removeFriend(userId, id);
  }

  @Get('friends')
  @ApiOperation({ summary: 'Meine Freunde' })
  getFriends(@CurrentUser('id') userId: string) {
    return this.socialService.getFriends(userId);
  }

  @Get('friends/pending')
  @ApiOperation({ summary: 'Offene Freundschaftsanfragen' })
  getPending(@CurrentUser('id') userId: string) {
    return this.socialService.getPendingRequests(userId);
  }

  // ─── Job-Empfehlungen ────────────────────────────────────────────────────────

  @Post('recommendations')
  @ApiOperation({ summary: 'Stelle an Freund empfehlen' })
  recommendJob(@CurrentUser('id') userId: string, @Body() body: { receiverId: string; jobPostId: string; message?: string }) {
    return this.socialService.recommendJob(userId, body.receiverId, body.jobPostId, body.message);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Empfangene Empfehlungen' })
  getRecommendations(@CurrentUser('id') userId: string) {
    return this.socialService.getRecommendations(userId);
  }

  // ─── Referral ────────────────────────────────────────────────────────────────

  @Get('referral')
  @ApiOperation({ summary: 'Meinen Empfehlungscode abrufen/erstellen' })
  getReferralCode(@CurrentUser('id') userId: string) {
    return this.socialService.getOrCreateReferralCode(userId);
  }

  @Post('referral/redeem')
  @ApiOperation({ summary: 'Empfehlungscode einlösen' })
  redeemReferral(@CurrentUser('id') userId: string, @Body('code') code: string) {
    return this.socialService.useReferralCode(userId, code);
  }

  // ─── Skill-Tests ─────────────────────────────────────────────────────────────

  @Get('skill-tests')
  @ApiOperation({ summary: 'Verfügbare Skill-Tests' })
  getTests() {
    return this.socialService.getAvailableTests();
  }

  @Get('skill-tests/:slug')
  @ApiOperation({ summary: 'Skill-Test laden' })
  getTest(@Param('slug') slug: string) {
    return this.socialService.getTest(slug);
  }

  @Post('skill-tests/:testId/submit')
  @ApiOperation({ summary: 'Skill-Test-Ergebnis einreichen' })
  submitResult(@CurrentUser('id') userId: string, @Param('testId') testId: string, @Body() body: any) {
    return this.socialService.submitTestResult(userId, testId, body);
  }

  @Get('skill-tests/results/mine')
  @ApiOperation({ summary: 'Meine Test-Ergebnisse' })
  getMyResults(@CurrentUser('id') userId: string) {
    return this.socialService.getMyTestResults(userId);
  }
}
