import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SalaryService } from './salary.service';

@ApiTags('Gehaltsrechner')
@Controller('api')
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  @Get('public/salary')
  @ApiOperation({ summary: 'Gehaltsstatistik für Beruf/Stadt' })
  @ApiQuery({ name: 'profession', required: true })
  @ApiQuery({ name: 'city', required: false })
  getSalaryStats(@Query('profession') profession: string, @Query('city') city?: string) {
    return this.salaryService.getSalaryStats(profession, city);
  }

  @Get('public/salary/comparison')
  @ApiOperation({ summary: 'Gehaltsvergleich nach Region' })
  @ApiQuery({ name: 'profession', required: true })
  getSalaryComparison(@Query('profession') profession: string) {
    return this.salaryService.getSalaryComparison(profession);
  }

  @Post('user/salary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gehalt melden (anonym)' })
  submitSalary(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.salaryService.submitSalary(userId, body);
  }
}
