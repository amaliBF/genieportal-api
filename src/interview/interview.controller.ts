import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InterviewService } from './interview.service';

@ApiTags('Dashboard - Interviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('api/dashboard/interviews')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post('slots')
  @ApiOperation({ summary: 'Interview-Zeitfenster erstellen' })
  createSlots(@CurrentUser('companyId') companyId: string, @Body() body: any) {
    return this.interviewService.createSlots(companyId, body);
  }

  @Get('slots')
  @ApiOperation({ summary: 'Verfügbare Zeitfenster abrufen' })
  @ApiQuery({ name: 'jobPostId', required: false })
  @ApiQuery({ name: 'date', required: false })
  getSlots(@CurrentUser('companyId') companyId: string, @Query('jobPostId') jobPostId?: string, @Query('date') date?: string) {
    return this.interviewService.getSlots(companyId, jobPostId, date);
  }

  @Delete('slots/:slotId')
  @ApiOperation({ summary: 'Zeitfenster löschen' })
  deleteSlot(@CurrentUser('companyId') companyId: string, @Param('slotId') slotId: string) {
    return this.interviewService.deleteSlot(companyId, slotId);
  }

  @Post('book')
  @ApiOperation({ summary: 'Interview buchen' })
  bookInterview(@CurrentUser('companyId') companyId: string, @Body() body: any) {
    return this.interviewService.bookInterview(companyId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Alle Interviews' })
  @ApiQuery({ name: 'status', required: false })
  getInterviews(@CurrentUser('companyId') companyId: string, @Query('status') status?: string) {
    return this.interviewService.getInterviews(companyId, status);
  }

  @Put(':interviewId/status')
  @ApiOperation({ summary: 'Interview-Status aktualisieren' })
  updateStatus(
    @CurrentUser('companyId') companyId: string,
    @Param('interviewId') id: string,
    @Body() body: { status: string; feedback?: string; rating?: number },
  ) {
    return this.interviewService.updateInterviewStatus(companyId, id, body.status, body.feedback, body.rating);
  }

  @Post(':interviewId/cancel')
  @ApiOperation({ summary: 'Interview absagen' })
  cancel(@CurrentUser('companyId') companyId: string, @Param('interviewId') id: string) {
    return this.interviewService.cancelInterview(companyId, id);
  }
}
