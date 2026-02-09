import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JobAnalyticsService } from './job-analytics.service';
import { JobAnalyticsController } from './job-analytics.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [JobAnalyticsController],
  providers: [JobAnalyticsService],
  exports: [JobAnalyticsService],
})
export class JobAnalyticsModule {}
