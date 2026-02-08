import { Module } from '@nestjs/common';
import {
  CompaniesController,
  CompanyDashboardController,
} from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  controllers: [CompaniesController, CompanyDashboardController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
