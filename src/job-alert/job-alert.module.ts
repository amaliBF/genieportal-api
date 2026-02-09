import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JobAlertService } from './job-alert.service';
import { JobAlertPublicController, JobAlertUserController } from './job-alert.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [JwtModule.register({}), EmailModule],
  controllers: [JobAlertPublicController, JobAlertUserController],
  providers: [JobAlertService],
  exports: [JobAlertService],
})
export class JobAlertModule {}
