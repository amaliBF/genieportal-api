import { Module } from '@nestjs/common';
import { JobsController, JobsDashboardController } from './jobs.controller';
import { PublicJobsController } from './public-jobs.controller';
import { JobsService } from './jobs.service';
import { PublicJobsService } from './public-jobs.service';

@Module({
  controllers: [JobsController, JobsDashboardController, PublicJobsController],
  providers: [JobsService, PublicJobsService],
  exports: [JobsService, PublicJobsService],
})
export class JobsModule {}
