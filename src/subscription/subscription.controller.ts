import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { SubscriptionService } from './subscription.service';
import { CheckoutDto, PayPalCaptureDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

// =============================================================================
// DASHBOARD ROUTES (Authenticated)
// =============================================================================

@ApiTags('Dashboard - Subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/subscription')
export class SubscriptionDashboardController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'Aktuelles Abonnement abrufen' })
  async getCurrent(@CurrentUser('companyId') companyId: string) {
    return this.subscriptionService.getCurrentSubscription(companyId);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Checkout-Session erstellen (Stripe oder PayPal)' })
  async createCheckout(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CheckoutDto,
  ) {
    const provider = dto.provider || 'paypal';

    if (provider === 'stripe') {
      return this.subscriptionService.createCheckoutSession(
        companyId,
        dto.plan,
      );
    }

    return this.subscriptionService.createPayPalCheckout(companyId, dto.plan);
  }

  @Post('portal')
  @ApiOperation({ summary: 'Stripe Kundenportal-Session erstellen' })
  async createPortal(@CurrentUser('companyId') companyId: string) {
    return this.subscriptionService.createPortalSession(companyId);
  }

  @Post('paypal/activate')
  @ApiOperation({ summary: 'PayPal-Abo nach Rueckkehr aktivieren' })
  async activatePayPal(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: PayPalCaptureDto,
  ) {
    return this.subscriptionService.activatePayPalSubscription(
      companyId,
      dto.subscriptionId,
    );
  }

  @Post('paypal/cancel')
  @ApiOperation({ summary: 'PayPal-Abo kuendigen' })
  async cancelPayPal(@CurrentUser('companyId') companyId: string) {
    return this.subscriptionService.cancelPayPalSubscription(companyId);
  }
}

// =============================================================================
// WEBHOOK ROUTES (No auth, raw body)
// =============================================================================

@ApiTags('Webhooks')
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Stripe Webhook empfangen' })
  @ApiExcludeEndpoint()
  async handleWebhook(@Req() req: RawBodyRequest) {
    const sig = req.headers['stripe-signature'] as string;

    if (!req.rawBody) {
      throw new Error(
        'Raw body is not available. Ensure rawBody is enabled in NestFactory.create(). ' +
          'Add { rawBody: true } to the options: NestFactory.create(AppModule, { rawBody: true })',
      );
    }

    return this.subscriptionService.handleWebhook(req.rawBody, sig);
  }
}

@ApiTags('Webhooks')
@Controller('webhooks/paypal')
export class PayPalWebhookController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'PayPal Webhook empfangen' })
  @ApiExcludeEndpoint()
  async handleWebhook(@Req() req: Request) {
    const headers: Record<string, string> = {};
    for (const key of [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time',
    ]) {
      headers[key] = req.headers[key] as string;
    }

    const body =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    return this.subscriptionService.handlePayPalWebhook(headers, body);
  }
}
