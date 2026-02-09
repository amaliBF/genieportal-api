import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiConsumes,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadService } from '../upload/upload.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private uploadService: UploadService,
    private prisma: PrismaService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Eigenes Profil abrufen' })
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Profil aktualisieren' })
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Put('avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Avatar hochladen' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadAvatar(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.uploadService.validateImage(file);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.avatarUrl) {
      await this.uploadService.deleteFile(user.avatarUrl);
    }
    const avatarUrl = await this.uploadService.saveFile(file, 'avatars', userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    return { avatarUrl };
  }

  @Put('preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Praeferenzen aktualisieren (Berufe, Entfernung, Benachrichtigungen)' })
  async updatePreferences(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(userId, dto);
  }

  @Put('location')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Standort aktualisieren' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['postalCode', 'city'],
      properties: {
        postalCode: { type: 'string', example: '10115' },
        city: { type: 'string', example: 'Berlin' },
        lat: { type: 'number', example: 52.532614 },
        lng: { type: 'number', example: 13.383068 },
      },
    },
  })
  async updateLocation(
    @CurrentUser('userId') userId: string,
    @Body('postalCode') postalCode: string,
    @Body('city') city: string,
    @Body('lat') lat?: number,
    @Body('lng') lng?: number,
  ) {
    return this.usersService.updateLocation(userId, postalCode, city, lat, lng);
  }

  @Put('push-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Push-Token registrieren (Expo/FCM)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string', description: 'Expo Push Token oder FCM Token' },
        platform: { type: 'string', enum: ['expo', 'fcm', 'apns'], description: 'Token-Plattform' },
      },
    },
  })
  async registerPushToken(
    @CurrentUser('userId') userId: string,
    @Body('token') token: string,
    @Body('platform') platform?: string,
  ) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token, pushEnabled: true },
    });
    return { success: true };
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Account löschen (Soft Delete)' })
  async deleteAccount(@CurrentUser('userId') userId: string) {
    return this.usersService.deleteAccount(userId);
  }

  // ─── BEREICHE (Portale) ──────────────────────────────────────────────────

  @Get('bereiche')
  @ApiOperation({ summary: 'Aktive Bereiche des Users abrufen' })
  async getBereiche(@CurrentUser('userId') userId: string) {
    return this.usersService.getBereiche(userId);
  }

  @Post('bereiche/:portalId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bereich aktivieren' })
  @ApiParam({ name: 'portalId', type: Number, description: 'Portal-ID' })
  async activateBereich(
    @CurrentUser('userId') userId: string,
    @Param('portalId', ParseIntPipe) portalId: number,
    @Body() body: { profileData?: Record<string, any> },
  ) {
    return this.usersService.activateBereich(userId, portalId, body.profileData);
  }

  @Put('bereiche/:portalId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bereichs-Profildaten aktualisieren' })
  @ApiParam({ name: 'portalId', type: Number, description: 'Portal-ID' })
  async updateBereich(
    @CurrentUser('userId') userId: string,
    @Param('portalId', ParseIntPipe) portalId: number,
    @Body() body: { profileData: Record<string, any> },
  ) {
    return this.usersService.updateBereich(userId, portalId, body.profileData);
  }

  @Delete('bereiche/:portalId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bereich deaktivieren' })
  @ApiParam({ name: 'portalId', type: Number, description: 'Portal-ID' })
  async deactivateBereich(
    @CurrentUser('userId') userId: string,
    @Param('portalId', ParseIntPipe) portalId: number,
  ) {
    return this.usersService.deactivateBereich(userId, portalId);
  }
}
