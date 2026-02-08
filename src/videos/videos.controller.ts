import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES - Videos
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Videos (Public)')
@Controller('videos')
export class VideosController {
  constructor(private videosService: VideosService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnes Video abrufen' })
  @ApiParam({ name: 'id', description: 'Video ID (UUID)' })
  async findOne(@Param('id') id: string) {
    return this.videosService.findOne(id);
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Video-Aufruf tracken' })
  @ApiParam({ name: 'id', description: 'Video ID (UUID)' })
  async trackView(@Param('id') id: string) {
    return this.videosService.trackView(id);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES - Feed
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Feed')
@Controller('feed')
export class FeedController {
  constructor(private videosService: VideosService) {}

  @Get('videos')
  @ApiOperation({ summary: 'Video-Feed abrufen (paginiert, optional nach Portal filtern)' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Seitennummer (Standard: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Einträge pro Seite (Standard: 10, Max: 50)',
    example: 10,
  })
  @ApiQuery({
    name: 'portalId',
    required: false,
    type: Number,
    description: 'Nach Portal/Bereich filtern',
  })
  async getFeed(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('portalId') portalId?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit ?? '10', 10) || 10));
    const portal = portalId ? parseInt(portalId, 10) || undefined : undefined;
    return this.videosService.findFeed(pageNum, limitNum, portal);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD ROUTES (Authenticated)
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Dashboard - Videos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/videos')
export class VideosDashboardController {
  constructor(private videosService: VideosService) {}

  @Get()
  @ApiOperation({ summary: 'Eigene Videos auflisten' })
  async findOwn(@CurrentUser('companyId') companyId: string) {
    return this.videosService.findByCompany(companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Neues Video hochladen' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string', example: 'Ein Tag als Elektroniker' },
        description: { type: 'string', example: 'Begleite unseren Azubi...' },
        jobPostId: { type: 'string' },
        professionId: { type: 'string' },
        videoType: {
          type: 'string',
          enum: ['day_in_life', 'azubi_interview', 'company_tour'],
        },
        featuredPerson: { type: 'string', example: 'Max Mustermann' },
      },
    },
  })
  async create(
    @CurrentUser('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateVideoDto,
  ) {
    return this.videosService.create(companyId, file, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Video-Metadaten aktualisieren' })
  @ApiParam({ name: 'id', description: 'Video ID (UUID)' })
  async update(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdateVideoDto,
  ) {
    return this.videosService.update(id, companyId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Video löschen (Soft-Delete)' })
  @ApiParam({ name: 'id', description: 'Video ID (UUID)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.videosService.remove(id, companyId);
  }
}
