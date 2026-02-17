import { Module } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';
import { NewsletterAdminService } from './newsletter-admin.service';
import { NewsletterAdminController } from './newsletter-admin.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule],
  controllers: [NewsletterController, NewsletterAdminController],
  providers: [NewsletterService, NewsletterAdminService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
