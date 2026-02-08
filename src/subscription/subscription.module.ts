import { Module } from '@nestjs/common';
import {
  SubscriptionDashboardController,
  StripeWebhookController,
  PayPalWebhookController,
} from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { PayPalService } from './paypal.service';

@Module({
  controllers: [
    SubscriptionDashboardController,
    StripeWebhookController,
    PayPalWebhookController,
  ],
  providers: [SubscriptionService, PayPalService],
  exports: [SubscriptionService, PayPalService],
})
export class SubscriptionModule {}
