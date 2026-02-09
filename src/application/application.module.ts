import { Module } from '@nestjs/common';
import { ApplicationPublicController, ApplicationDashboardController } from './application.controller';
import { ApplicationService } from './application.service';
import { WebhookService } from './webhook.service';
import { UploadModule } from '../upload/upload.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [UploadModule, EmailModule],
  controllers: [ApplicationPublicController, ApplicationDashboardController],
  providers: [ApplicationService, WebhookService],
  exports: [ApplicationService, WebhookService],
})
export class ApplicationModule {}
