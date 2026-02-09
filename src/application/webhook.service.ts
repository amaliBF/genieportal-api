import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHmac } from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private prisma: PrismaService) {}

  async dispatch(companyId: string, event: string, payload: any) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { companyId, isActive: true },
    });

    for (const webhook of webhooks) {
      const events = webhook.events as string[];
      if (!events.includes(event)) continue;

      this.sendWebhook(webhook, event, payload).catch(() => {});
    }
  }

  private async sendWebhook(webhook: any, event: string, payload: any) {
    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Genie-Signature': signature,
          'X-Genie-Event': event,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      await this.prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          ...(response.ok ? { failureCount: 0 } : { failureCount: { increment: 1 } }),
        },
      });

      if (!response.ok) {
        this.logger.warn(`Webhook ${webhook.id} returned ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Webhook ${webhook.id} failed: ${(error as Error).message}`);
      const updated = await this.prisma.webhook.update({
        where: { id: webhook.id },
        data: { failureCount: { increment: 1 } },
      });

      if (updated.failureCount >= 10) {
        await this.prisma.webhook.update({
          where: { id: webhook.id },
          data: { isActive: false },
        });
        this.logger.warn(`Webhook ${webhook.id} deactivated after 10 failures`);
      }
    }
  }
}
