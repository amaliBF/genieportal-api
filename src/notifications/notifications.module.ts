import { Module } from '@nestjs/common';
import {
  NotificationsController,
  DashboardNotificationsController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController, DashboardNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
