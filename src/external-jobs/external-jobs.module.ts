import { Module } from '@nestjs/common';
import { ExternalJobsService } from './external-jobs.service';
import { ExternalJobsController } from './external-jobs.controller';
import { AdzunaProvider } from './providers/adzuna.provider';
import { JoobleProvider } from './providers/jooble.provider';
import { CareerjetProvider } from './providers/careerjet.provider';

@Module({
  controllers: [ExternalJobsController],
  providers: [
    ExternalJobsService,
    AdzunaProvider,
    JoobleProvider,
    CareerjetProvider,
  ],
  exports: [ExternalJobsService],
})
export class ExternalJobsModule {}
