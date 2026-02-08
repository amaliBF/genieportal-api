import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PayPalService } from './paypal.service';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

// ─── PLAN LIMITS ──────────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<string, { maxJobPosts: number; maxVideos: number }> = {
  FREE: { maxJobPosts: 1, maxVideos: 0 },
  STARTER: { maxJobPosts: 3, maxVideos: 3 },
  PRO: { maxJobPosts: 10, maxVideos: 10 },
  ENTERPRISE: { maxJobPosts: 999, maxVideos: 999 },
};

const PLAN_PRICES: Record<string, number> = {
  STARTER: 49,
  PRO: 149,
  ENTERPRISE: 399,
};

const PLAN_LABELS: Record<string, string> = {
  STARTER: 'Starter',
  PRO: 'Professional',
  ENTERPRISE: 'Enterprise',
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private emailService: EmailService,
    private paypalService: PayPalService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set. Stripe integration is disabled; methods will return mock data.',
      );
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private getPriceId(plan: string): string {
    const map: Record<string, string | undefined> = {
      STARTER: this.config.get<string>('STRIPE_PRICE_STARTER'),
      PRO: this.config.get<string>('STRIPE_PRICE_PRO'),
      ENTERPRISE: this.config.get<string>('STRIPE_PRICE_ENTERPRISE'),
    };
    const priceId = map[plan];
    if (!priceId) {
      throw new BadRequestException(
        `Kein Stripe-Preis fuer den Plan "${plan}" konfiguriert`,
      );
    }
    return priceId;
  }

  private async getOrCreateStripeCustomer(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        stripeCustomerId: true,
        name: true,
        email: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    if (company.stripeCustomerId) {
      return company.stripeCustomerId;
    }

    const customer = await this.stripe!.customers.create({
      metadata: { companyId: company.id },
      name: company.name ?? undefined,
      email: (company as any).email ?? undefined,
    });

    await this.prisma.company.update({
      where: { id: companyId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  // ─── GET CURRENT SUBSCRIPTION ─────────────────────────────────────────────

  async getCurrentSubscription(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        paypalSubscriptionId: true,
        maxJobPosts: true,
        maxVideos: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    const provider = company.paypalSubscriptionId
      ? 'paypal'
      : company.stripeSubscriptionId
        ? 'stripe'
        : null;

    return {
      plan: company.subscriptionPlan,
      status: company.subscriptionStatus,
      maxJobPosts: company.maxJobPosts,
      maxVideos: company.maxVideos,
      stripeCustomerId: company.stripeCustomerId,
      stripeSubscriptionId: company.stripeSubscriptionId,
      paypalSubscriptionId: company.paypalSubscriptionId,
      provider,
      currentSubscription: subscription,
    };
  }

  // ─── CREATE CHECKOUT SESSION ──────────────────────────────────────────────

  async createCheckoutSession(companyId: string, plan: string) {
    const dashboardUrl = this.config.get<string>(
      'DASHBOARD_URL',
      'https://dashboard.genieportal.de',
    );

    if (!this.stripe) {
      this.logger.warn('Stripe is disabled. Returning mock checkout URL.');
      return {
        url: `${dashboardUrl}/subscription/mock-checkout?plan=${plan}`,
      };
    }

    if (plan === 'FREE') {
      throw new BadRequestException(
        'Fuer den kostenlosen Plan ist kein Checkout erforderlich',
      );
    }

    const priceId = this.getPriceId(plan);
    const customerId = await this.getOrCreateStripeCustomer(companyId);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${dashboardUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${dashboardUrl}/subscription/cancel`,
      metadata: { companyId, plan },
    });

    return { url: session.url };
  }

  // ─── CREATE PORTAL SESSION ────────────────────────────────────────────────

  async createPortalSession(companyId: string) {
    const dashboardUrl = this.config.get<string>(
      'DASHBOARD_URL',
      'https://dashboard.genieportal.de',
    );

    if (!this.stripe) {
      this.logger.warn('Stripe is disabled. Returning mock portal URL.');
      return {
        url: `${dashboardUrl}/subscription/mock-portal`,
      };
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { stripeCustomerId: true },
    });

    if (!company?.stripeCustomerId) {
      throw new BadRequestException(
        'Kein Stripe-Kundenkonto vorhanden. Bitte zuerst ein Abo abschliessen.',
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: company.stripeCustomerId,
      return_url: `${dashboardUrl}/settings`,
    });

    return { url: session.url };
  }

  // ─── UPDATE PLAN LIMITS ───────────────────────────────────────────────────

  async updatePlanLimits(companyId: string, plan: string) {
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;

    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        subscriptionPlan: plan as any,
        maxJobPosts: limits.maxJobPosts,
        maxVideos: limits.maxVideos,
      },
    });

    this.logger.log(
      `Plan limits updated for company ${companyId}: plan=${plan}, maxJobPosts=${limits.maxJobPosts}, maxVideos=${limits.maxVideos}`,
    );
  }

  // ─── HANDLE WEBHOOK ───────────────────────────────────────────────────────

  async handleWebhook(payload: Buffer, signature: string) {
    if (!this.stripe) {
      this.logger.warn('Stripe is disabled. Ignoring webhook.');
      return { received: true };
    }

    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured');
      throw new BadRequestException('Webhook-Secret nicht konfiguriert');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Ungueltige Webhook-Signatur');
    }

    this.logger.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  // ─── WEBHOOK HANDLERS ────────────────────────────────────────────────────

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const companyId = session.metadata?.companyId;
    const plan = session.metadata?.plan;

    if (!companyId || !plan) {
      this.logger.warn(
        'checkout.session.completed missing companyId or plan in metadata',
      );
      return;
    }

    const subscriptionId = session.subscription as string;

    // Retrieve full subscription details from Stripe
    const stripeSubscription =
      await this.stripe!.subscriptions.retrieve(subscriptionId);

    const item = stripeSubscription.items.data[0];
    const priceId = item?.price?.id ?? null;
    const priceMonthly = item?.price?.unit_amount
      ? item.price.unit_amount / 100
      : null;
    const currency = item?.price?.currency ?? 'eur';

    // Update company
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        stripeSubscriptionId: subscriptionId,
        subscriptionPlan: plan as any,
        subscriptionStatus: 'ACTIVE',
      },
    });

    // Create subscription record
    await this.prisma.subscription.create({
      data: {
        companyId,
        plan: plan as any,
        status: 'ACTIVE',
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        priceMonthly: priceMonthly ? new Prisma.Decimal(priceMonthly.toString()) : null,
        currency,
        currentPeriodStart: new Date(
          (stripeSubscription as any).current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          (stripeSubscription as any).current_period_end * 1000,
        ),
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
      },
    });

    // Update plan limits
    await this.updatePlanLimits(companyId, plan);

    // Send payment success email (fire-and-forget)
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true },
    });
    if (company?.email) {
      const planLabels: Record<string, string> = {
        STARTER: 'Starter',
        PRO: 'Professional',
        ENTERPRISE: 'Enterprise',
      };
      this.emailService
        .sendPaymentSuccessEmail(
          company.email,
          company.name || 'Ihr Betrieb',
          planLabels[plan] || plan,
          priceMonthly?.toString() || '0',
        )
        .catch(() => {});
    }

    this.logger.log(
      `Checkout completed: company=${companyId}, plan=${plan}, subscription=${subscriptionId}`,
    );
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!company) {
      this.logger.warn(
        `customer.subscription.updated: no company found for subscription ${subscription.id}`,
      );
      return;
    }

    // Determine plan from price ID
    const priceId = subscription.items.data[0]?.price?.id;
    const plan = this.planFromPriceId(priceId);
    const status = this.mapStripeStatus(subscription.status);

    // Update company
    await this.prisma.company.update({
      where: { id: company.id },
      data: {
        subscriptionPlan: plan as any,
        subscriptionStatus: status as any,
      },
    });

    // Update subscription record
    const existingSub = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSub) {
      await this.prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          plan: plan as any,
          status: status as any,
          stripePriceId: priceId ?? existingSub.stripePriceId,
          currentPeriodStart: new Date(
            (subscription as any).current_period_start * 1000,
          ),
          currentPeriodEnd: new Date(
            (subscription as any).current_period_end * 1000,
          ),
          cancelAt: subscription.cancel_at
            ? new Date(subscription.cancel_at * 1000)
            : null,
          canceledAt: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : null,
        },
      });
    }

    // Update plan limits
    await this.updatePlanLimits(company.id, plan);

    this.logger.log(
      `Subscription updated: company=${company.id}, plan=${plan}, status=${status}`,
    );
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!company) {
      this.logger.warn(
        `customer.subscription.deleted: no company found for subscription ${subscription.id}`,
      );
      return;
    }

    // Revert to FREE plan
    await this.prisma.company.update({
      where: { id: company.id },
      data: {
        subscriptionPlan: 'FREE',
        subscriptionStatus: 'CANCELED',
        stripeSubscriptionId: null,
      },
    });

    // Update subscription record
    const existingSub = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSub) {
      await this.prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
        },
      });
    }

    // Revert limits to FREE
    await this.updatePlanLimits(company.id, 'FREE');

    this.logger.log(
      `Subscription deleted: company=${company.id}, reverted to FREE`,
    );
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = (invoice as any).subscription as string | null;

    if (!subscriptionId) {
      this.logger.warn('invoice.payment_failed: no subscription ID on invoice');
      return;
    }

    const company = await this.prisma.company.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!company) {
      this.logger.warn(
        `invoice.payment_failed: no company found for subscription ${subscriptionId}`,
      );
      return;
    }

    await this.prisma.company.update({
      where: { id: company.id },
      data: { subscriptionStatus: 'PAST_DUE' },
    });

    const existingSub = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSub) {
      await this.prisma.subscription.update({
        where: { id: existingSub.id },
        data: { status: 'PAST_DUE' },
      });
    }

    // Send payment failed email (fire-and-forget)
    if (company.email) {
      const planLabels: Record<string, string> = {
        STARTER: 'Starter',
        PRO: 'Professional',
        ENTERPRISE: 'Enterprise',
      };
      const currentPlan = (company as any).subscriptionPlan || 'FREE';
      this.emailService
        .sendPaymentFailedEmail(
          company.email,
          company.name || 'Ihr Betrieb',
          planLabels[currentPlan] || currentPlan,
        )
        .catch(() => {});
    }

    this.logger.log(
      `Payment failed: company=${company.id}, status set to PAST_DUE`,
    );
  }

  // ─── STATUS / PLAN MAPPING HELPERS ────────────────────────────────────────

  private planFromPriceId(priceId: string | undefined): string {
    if (!priceId) return 'FREE';

    const starterPrice = this.config.get<string>('STRIPE_PRICE_STARTER');
    const proPrice = this.config.get<string>('STRIPE_PRICE_PRO');
    const enterprisePrice = this.config.get<string>('STRIPE_PRICE_ENTERPRISE');

    if (priceId === starterPrice) return 'STARTER';
    if (priceId === proPrice) return 'PRO';
    if (priceId === enterprisePrice) return 'ENTERPRISE';

    this.logger.warn(`Unknown Stripe price ID: ${priceId}, defaulting to FREE`);
    return 'FREE';
  }

  private mapStripeStatus(
    stripeStatus: Stripe.Subscription.Status,
  ): string {
    switch (stripeStatus) {
      case 'active':
        return 'ACTIVE';
      case 'past_due':
        return 'PAST_DUE';
      case 'canceled':
        return 'CANCELED';
      case 'trialing':
        return 'TRIALING';
      default:
        return 'ACTIVE';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYPAL INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  private getPayPalPlanId(plan: string): string {
    const map: Record<string, string | undefined> = {
      STARTER: this.config.get<string>('PAYPAL_PLAN_STARTER'),
      PRO: this.config.get<string>('PAYPAL_PLAN_PRO'),
      ENTERPRISE: this.config.get<string>('PAYPAL_PLAN_ENTERPRISE'),
    };
    const planId = map[plan];
    if (!planId) {
      throw new BadRequestException(
        `Kein PayPal-Plan fuer "${plan}" konfiguriert. Bitte zuerst PayPal-Abo-Plaene erstellen.`,
      );
    }
    return planId;
  }

  // ─── PAYPAL CHECKOUT ────────────────────────────────────────────────────────

  async createPayPalCheckout(companyId: string, plan: string) {
    if (!this.paypalService.isEnabled()) {
      throw new BadRequestException('PayPal ist nicht konfiguriert');
    }

    if (plan === 'FREE') {
      throw new BadRequestException(
        'Fuer den kostenlosen Plan ist kein Checkout erforderlich',
      );
    }

    const dashboardUrl = this.config.get<string>(
      'DASHBOARD_URL',
      'https://dashboard.genieportal.de',
    );

    const paypalPlanId = this.getPayPalPlanId(plan);

    const subscription = await this.paypalService.createSubscription(
      paypalPlanId,
      `${dashboardUrl}/subscription/success?provider=paypal&plan=${plan}`,
      `${dashboardUrl}/subscription/cancel`,
      { companyId, plan },
    );

    // Find the approval link
    const approveLink = subscription.links?.find(
      (l) => l.rel === 'approve',
    );

    if (!approveLink) {
      throw new BadRequestException(
        'PayPal hat keinen Approval-Link zurueckgegeben',
      );
    }

    return {
      url: approveLink.href,
      subscriptionId: subscription.id,
      provider: 'paypal',
    };
  }

  // ─── PAYPAL ACTIVATE (nach Rueckkehr vom PayPal-Checkout) ──────────────────

  async activatePayPalSubscription(
    companyId: string,
    paypalSubscriptionId: string,
  ) {
    if (!this.paypalService.isEnabled()) {
      throw new BadRequestException('PayPal ist nicht konfiguriert');
    }

    // Get subscription details from PayPal
    const ppSub =
      await this.paypalService.getSubscriptionDetails(paypalSubscriptionId);

    if (ppSub.status !== 'ACTIVE' && ppSub.status !== 'APPROVED') {
      throw new BadRequestException(
        `PayPal-Abo ist nicht aktiv (Status: ${ppSub.status})`,
      );
    }

    // Parse metadata
    let metadata: any = {};
    try {
      metadata = JSON.parse(ppSub.custom_id || '{}');
    } catch {
      // ignore parse errors
    }

    const plan = metadata.plan || 'STARTER';
    const price = PLAN_PRICES[plan] || 0;

    // Update company
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        subscriptionPlan: plan as any,
        subscriptionStatus: 'ACTIVE',
        paypalSubscriptionId,
      },
    });

    // Create subscription record
    await this.prisma.subscription.create({
      data: {
        companyId,
        plan: plan as any,
        status: 'ACTIVE',
        paypalSubscriptionId,
        priceMonthly: new Prisma.Decimal(price.toString()),
        currency: 'EUR',
        currentPeriodStart: ppSub.billing_info?.last_payment?.time
          ? new Date(ppSub.billing_info.last_payment.time)
          : new Date(),
        currentPeriodEnd: ppSub.billing_info?.next_billing_time
          ? new Date(ppSub.billing_info.next_billing_time)
          : null,
      },
    });

    // Update plan limits
    await this.updatePlanLimits(companyId, plan);

    // Send payment success email (fire-and-forget)
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true },
    });
    if (company?.email) {
      this.emailService
        .sendPaymentSuccessEmail(
          company.email,
          company.name || 'Ihr Betrieb',
          PLAN_LABELS[plan] || plan,
          price.toString(),
        )
        .catch(() => {});
    }

    this.logger.log(
      `PayPal subscription activated: company=${companyId}, plan=${plan}, ppSub=${paypalSubscriptionId}`,
    );

    return {
      success: true,
      plan,
      status: 'ACTIVE',
    };
  }

  // ─── PAYPAL CANCEL ──────────────────────────────────────────────────────────

  async cancelPayPalSubscription(companyId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        companyId,
        paypalSubscriptionId: { not: null },
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub?.paypalSubscriptionId) {
      throw new BadRequestException('Kein aktives PayPal-Abo gefunden');
    }

    await this.paypalService.cancelSubscription(
      sub.paypalSubscriptionId,
      'Vom Kunden gekuendigt',
    );

    // Update DB
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });

    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        subscriptionPlan: 'FREE',
        subscriptionStatus: 'CANCELED',
        paypalSubscriptionId: null,
      },
    });

    await this.updatePlanLimits(companyId, 'FREE');

    this.logger.log(`PayPal subscription canceled: company=${companyId}`);

    return { success: true, plan: 'FREE' };
  }

  // ─── PAYPAL WEBHOOK ─────────────────────────────────────────────────────────

  async handlePayPalWebhook(
    headers: Record<string, string>,
    body: string,
  ) {
    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');

    // Verify signature if webhook ID is configured
    if (webhookId && this.paypalService.isEnabled()) {
      const isValid = await this.paypalService.verifyWebhookSignature(
        headers,
        body,
        webhookId,
      );
      if (!isValid) {
        this.logger.error('PayPal webhook signature verification failed');
        throw new BadRequestException('Ungueltige PayPal-Webhook-Signatur');
      }
    }

    const event = JSON.parse(body);
    this.logger.log(`PayPal webhook received: ${event.event_type}`);

    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await this.handlePayPalSubscriptionActivated(event.resource);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await this.handlePayPalSubscriptionCanceled(event.resource);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await this.handlePayPalSubscriptionSuspended(event.resource);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        await this.handlePayPalPaymentCompleted(event.resource);
        break;

      default:
        this.logger.log(`Unhandled PayPal event: ${event.event_type}`);
    }

    return { received: true };
  }

  private async handlePayPalSubscriptionActivated(resource: any) {
    const ppSubId = resource.id;
    const sub = await this.prisma.subscription.findFirst({
      where: { paypalSubscriptionId: ppSubId },
    });

    if (!sub) {
      this.logger.warn(
        `PayPal subscription.activated: no DB record for ${ppSubId}`,
      );
      return;
    }

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        currentPeriodEnd: resource.billing_info?.next_billing_time
          ? new Date(resource.billing_info.next_billing_time)
          : sub.currentPeriodEnd,
      },
    });

    await this.prisma.company.update({
      where: { id: sub.companyId },
      data: { subscriptionStatus: 'ACTIVE' },
    });

    this.logger.log(`PayPal sub activated via webhook: ${ppSubId}`);
  }

  private async handlePayPalSubscriptionCanceled(resource: any) {
    const ppSubId = resource.id;
    const sub = await this.prisma.subscription.findFirst({
      where: { paypalSubscriptionId: ppSubId },
    });

    if (!sub) return;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });

    await this.prisma.company.update({
      where: { id: sub.companyId },
      data: {
        subscriptionPlan: 'FREE',
        subscriptionStatus: 'CANCELED',
      },
    });

    await this.updatePlanLimits(sub.companyId, 'FREE');

    this.logger.log(`PayPal sub canceled via webhook: ${ppSubId}`);
  }

  private async handlePayPalSubscriptionSuspended(resource: any) {
    const ppSubId = resource.id;
    const sub = await this.prisma.subscription.findFirst({
      where: { paypalSubscriptionId: ppSubId },
    });

    if (!sub) return;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'PAST_DUE' },
    });

    await this.prisma.company.update({
      where: { id: sub.companyId },
      data: { subscriptionStatus: 'PAST_DUE' },
    });

    // Send payment failed email
    const company = await this.prisma.company.findUnique({
      where: { id: sub.companyId },
      select: { name: true, email: true, subscriptionPlan: true },
    });
    if (company?.email) {
      this.emailService
        .sendPaymentFailedEmail(
          company.email,
          company.name || 'Ihr Betrieb',
          PLAN_LABELS[company.subscriptionPlan] || company.subscriptionPlan,
        )
        .catch(() => {});
    }

    this.logger.log(`PayPal sub suspended via webhook: ${ppSubId}`);
  }

  private async handlePayPalPaymentCompleted(resource: any) {
    const ppSubId = resource.billing_agreement_id;
    if (!ppSubId) return;

    const sub = await this.prisma.subscription.findFirst({
      where: { paypalSubscriptionId: ppSubId },
    });

    if (!sub) return;

    // Record payment
    const amount = resource.amount?.total || resource.amount?.value || '0';

    // Update subscription period
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
      },
    });

    this.logger.log(
      `PayPal payment completed: ${amount} EUR for sub ${ppSubId}`,
    );
  }

  // ─── PAYPAL SETUP (Admin-Endpoint) ──────────────────────────────────────────

  async setupPayPalPlans() {
    return this.paypalService.setupSubscriptionPlans();
  }
}
