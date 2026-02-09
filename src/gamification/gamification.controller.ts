import {
  Controller, Get, Post, Query, UseGuards, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GamificationService } from './gamification.service';

@ApiTags('Gamification')
@Controller('api')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('user/gamification/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Meine Gamification-Stats (XP, Level, Streak, Achievements)' })
  getMyStats(@CurrentUser('id') userId: string) {
    return this.gamificationService.getUserStats(userId);
  }

  @Get('user/gamification/achievements')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Alle Achievements (mit Unlock-Status)' })
  getAchievements(@CurrentUser('id') userId: string) {
    return this.gamificationService.getAllAchievements(userId);
  }

  @Post('user/gamification/check-achievements')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Achievement-Check auslösen' })
  checkAchievements(@CurrentUser('id') userId: string) {
    return this.gamificationService.checkAndAwardAchievements(userId);
  }

  @Post('user/gamification/streak')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Streak aktualisieren (täglicher Login)' })
  updateStreak(@CurrentUser('id') userId: string) {
    return this.gamificationService.updateStreak(userId);
  }

  @Get('public/leaderboard')
  @ApiOperation({ summary: 'Leaderboard (Top-User nach XP)' })
  @ApiQuery({ name: 'limit', required: false })
  getLeaderboard(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.gamificationService.getLeaderboard(limit);
  }

  @Get('public/achievements')
  @ApiOperation({ summary: 'Alle verfügbaren Achievements' })
  getAllAchievements() {
    return this.gamificationService.getAllAchievements();
  }
}
