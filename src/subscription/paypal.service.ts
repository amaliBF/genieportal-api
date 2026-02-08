import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PayPalAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

interface PayPalSubscription {
  id: string;
  status: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

interface PayPalProduct {
  id: string;
  name: string;
}

interface PayPalPlan {
  id: string;
  name: string;
  status: string;
}

@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly enabled: boolean;

  // Cache access token
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private config: ConfigService) {
    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');
    this.baseUrl =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    this.clientId = this.config.get<string>('PAYPAL_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET', '');
    this.enabled = !!(this.clientId && this.clientSecret);

    if (!this.enabled) {
      this.logger.warn(
        'PayPal credentials not configured. PayPal integration is disabled.',
      );
    } else {
      this.logger.log(`PayPal initialized in ${mode} mode`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ─── ACCESS TOKEN ───────────────────────────────────────────────────────────

  async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const auth = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`PayPal auth failed: ${err}`);
      throw new BadRequestException('PayPal-Authentifizierung fehlgeschlagen');
    }

    const data: PayPalAccessToken = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }

  // ─── EINMALZAHLUNG (ORDER) ──────────────────────────────────────────────────

  async createOrder(
    amount: number,
    description: string,
    metadata: Record<string, string> = {},
  ): Promise<PayPalOrder> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'EUR',
              value: amount.toFixed(2),
            },
            description,
            custom_id: JSON.stringify(metadata),
          },
        ],
        application_context: {
          brand_name: 'Ausbildungsgenie',
          locale: 'de-DE',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`PayPal createOrder failed: ${err}`);
      throw new BadRequestException('PayPal-Bestellung konnte nicht erstellt werden');
    }

    return response.json();
  }

  async captureOrder(orderId: string): Promise<any> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`PayPal captureOrder failed: ${err}`);
      throw new BadRequestException('PayPal-Zahlung konnte nicht abgeschlossen werden');
    }

    return response.json();
  }

  async getOrderDetails(orderId: string): Promise<any> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`PayPal getOrderDetails failed: ${err}`);
      throw new BadRequestException('PayPal-Bestelldetails nicht abrufbar');
    }

    return response.json();
  }

  // ─── ABONNEMENTS ───────────────────────────────────────────────────────────

  async createProduct(name: string, description: string): Promise<PayPalProduct> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        type: 'SERVICE',
        category: 'SOFTWARE',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`PayPal createProduct failed: ${err}`);
      throw new BadRequestException('PayPal-Produkt konnte nicht erstellt werden');
    }

    return response.json();
  }

  async createBillingPlan(
    productId: string,
    name: string,
    price: number,
  ): Promise<PayPalPlan> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: productId,
        name,
        status: 'ACTIVE',
        billing_cycles: [
          {
            frequency: { interval_unit: 'MONTH', interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0, // unlimited
            pricing_scheme: {
              fixed_price: {
                value: price.toFixed(2),
                currency_code: 'EUR',
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 3,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`PayPal createBillingPlan failed: ${err}`);
      throw new BadRequestException('PayPal-Aboplan konnte nicht erstellt werden');
    }

    return response.json();
  }

  async createSubscription(
    planId: string,
    returnUrl: string,
    cancelUrl: string,
    metadata: Record<string, string> = {},
  ): Promise<PayPalSubscription> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: JSON.stringify(metadata),
        application_context: {
          brand_name: 'Ausbildungsgenie',
          locale: 'de-DE',
          user_action: 'SUBSCRIBE_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`PayPal createSubscription failed: ${err}`);
      throw new BadRequestException('PayPal-Abo konnte nicht erstellt werden');
    }

    return response.json();
  }

  async getSubscriptionDetails(subscriptionId: string): Promise<any> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`PayPal getSubscriptionDetails failed: ${err}`);
      throw new BadRequestException('PayPal-Abodetails nicht abrufbar');
    }

    return response.json();
  }

  async cancelSubscription(
    subscriptionId: string,
    reason: string,
  ): Promise<void> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`PayPal cancelSubscription failed: ${err}`);
      throw new BadRequestException('PayPal-Abo konnte nicht gekuendigt werden');
    }
  }

  // ─── WEBHOOK VERIFICATION ──────────────────────────────────────────────────

  async verifyWebhookSignature(
    headers: Record<string, string>,
    body: string,
    webhookId: string,
  ): Promise<boolean> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        }),
      },
    );

    if (!response.ok) {
      this.logger.error('PayPal webhook verification request failed');
      return false;
    }

    const data = await response.json();
    return data.verification_status === 'SUCCESS';
  }

  // ─── SETUP: Abo-Pläne erstellen ────────────────────────────────────────────

  async setupSubscriptionPlans(): Promise<{
    productId: string;
    plans: Record<string, string>;
  }> {
    this.logger.log('Setting up PayPal subscription plans...');

    // Create product
    const product = await this.createProduct(
      'Ausbildungsgenie Abo',
      'Monatliches Abonnement fuer Ausbildungsbetriebe',
    );
    this.logger.log(`Product created: ${product.id}`);

    // Create plans
    const plans: Record<string, string> = {};

    const planConfig = [
      { key: 'STARTER', name: 'Starter', price: 49 },
      { key: 'PRO', name: 'Professional', price: 149 },
      { key: 'ENTERPRISE', name: 'Enterprise', price: 399 },
    ];

    for (const cfg of planConfig) {
      const plan = await this.createBillingPlan(
        product.id,
        cfg.name,
        cfg.price,
      );
      plans[cfg.key] = plan.id;
      this.logger.log(`Plan ${cfg.name} created: ${plan.id}`);
    }

    this.logger.log('PayPal plans setup complete. Add these to .env:');
    this.logger.log(`PAYPAL_PLAN_STARTER=${plans.STARTER}`);
    this.logger.log(`PAYPAL_PLAN_PRO=${plans.PRO}`);
    this.logger.log(`PAYPAL_PLAN_ENTERPRISE=${plans.ENTERPRISE}`);

    return { productId: product.id, plans };
  }
}
