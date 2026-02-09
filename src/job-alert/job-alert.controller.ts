import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JobAlertService } from './job-alert.service';
import { CreateJobAlertDto } from './dto/create-job-alert.dto';
import { UpdateJobAlertDto } from './dto/update-job-alert.dto';

// ─── PUBLIC ENDPOINTS (kein Login nötig) ────────────────────────────────────

@ApiTags('Public - Job-Alerts')
@Controller('api/public/job-alerts')
export class JobAlertPublicController {
  constructor(private readonly jobAlertService: JobAlertService) {}

  @Post()
  @ApiOperation({ summary: 'Job-Alert erstellen (öffentlich, Double-Opt-In)' })
  create(@Body() dto: CreateJobAlertDto) {
    return this.jobAlertService.createPublic(dto);
  }

  @Get('verify')
  @ApiOperation({ summary: 'E-Mail-Adresse für Job-Alert bestätigen' })
  @ApiQuery({ name: 'token', required: true })
  verify(@Query('token') token: string) {
    return this.jobAlertService.verify(token);
  }

  @Get('unsubscribe')
  @ApiOperation({ summary: 'Job-Alert abbestellen' })
  @ApiQuery({ name: 'token', required: true })
  unsubscribe(@Query('token') token: string) {
    return this.jobAlertService.unsubscribe(token);
  }
}

// ─── USER ENDPOINTS (mit Login) ─────────────────────────────────────────────

@ApiTags('User - Job-Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/user/job-alerts')
export class JobAlertUserController {
  constructor(private readonly jobAlertService: JobAlertService) {}

  @Post()
  @ApiOperation({ summary: 'Job-Alert erstellen (eingeloggter User)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateJobAlertDto) {
    return this.jobAlertService.createForUser(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Meine Job-Alerts abrufen' })
  findAll(@CurrentUser('id') userId: string) {
    return this.jobAlertService.findByUser(userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Job-Alert bearbeiten' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateJobAlertDto,
  ) {
    return this.jobAlertService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Job-Alert löschen' })
  delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.jobAlertService.delete(userId, id);
  }
}
