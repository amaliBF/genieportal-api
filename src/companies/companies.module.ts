import { Module } from '@nestjs/common';
import {
  CompaniesController,
  CompanyDashboardController,
} from './companies.controller';
import { PublicCompaniesController } from './public-companies.controller';
import { CompaniesService } from './companies.service';
import { PublicCompaniesService } from './public-companies.service';

@Module({
  controllers: [CompaniesController, CompanyDashboardController, PublicCompaniesController],
  providers: [CompaniesService, PublicCompaniesService],
  exports: [CompaniesService, PublicCompaniesService],
})
export class CompaniesModule {}
