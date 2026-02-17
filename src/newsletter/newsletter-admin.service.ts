import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class NewsletterAdminService {
  private readonly logger = new Logger(NewsletterAdminService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // ─── SUBSCRIBERS ────────────────────────────────────────────────────────────

  async getSubscribers(
    page: number,
    limit: number,
    search?: string,
    domain?: string,
    isVerified?: string,
  ) {
    const where: any = {};

    if (search) {
      where.email = { contains: search };
    }
    if (domain) {
      where.domain = domain;
    }
    if (isVerified === 'true') {
      where.isVerified = true;
    } else if (isVerified === 'false') {
      where.isVerified = false;
    }

    const [data, total] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.newsletterSubscriber.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSubscriberStats() {
    const [total, verified, active, recentCount, domainStats] =
      await Promise.all([
        this.prisma.newsletterSubscriber.count(),
        this.prisma.newsletterSubscriber.count({
          where: { isVerified: true },
        }),
        this.prisma.newsletterSubscriber.count({
          where: { isVerified: true, isActive: true },
        }),
        this.prisma.newsletterSubscriber.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        this.prisma.newsletterSubscriber.groupBy({
          by: ['domain'],
          _count: { id: true },
          where: { isVerified: true, isActive: true },
        }),
      ]);

    const byDomain: Record<string, number> = {};
    for (const row of domainStats) {
      byDomain[row.domain] = row._count.id;
    }

    return { total, verified, active, recentCount, byDomain };
  }

  // ─── CAMPAIGNS ──────────────────────────────────────────────────────────────

  async getCampaigns(page: number, limit: number) {
    const [data, total] = await Promise.all([
      this.prisma.newsletterCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.newsletterCampaign.count(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCampaign(id: string) {
    const campaign = await this.prisma.newsletterCampaign.findUnique({
      where: { id },
    });
    if (!campaign) {
      throw new NotFoundException('Kampagne nicht gefunden.');
    }
    return campaign;
  }

  async createCampaign(dto: CreateCampaignDto) {
    return this.prisma.newsletterCampaign.create({
      data: {
        subject: dto.subject,
        htmlContent: dto.htmlContent,
        targetDomains: dto.targetDomains?.join(',') || null,
        status: 'DRAFT',
      },
    });
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.getCampaign(id);
    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException(
        'Nur Entwürfe können bearbeitet werden.',
      );
    }

    const data: any = {};
    if (dto.subject !== undefined) data.subject = dto.subject;
    if (dto.htmlContent !== undefined) data.htmlContent = dto.htmlContent;
    if (dto.targetDomains !== undefined) {
      data.targetDomains = dto.targetDomains.join(',') || null;
    }

    return this.prisma.newsletterCampaign.update({
      where: { id },
      data,
    });
  }

  async sendCampaign(id: string) {
    const campaign = await this.getCampaign(id);
    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException(
        'Nur Entwürfe können versendet werden.',
      );
    }

    // Build domain filter
    const domainFilter = campaign.targetDomains
      ? campaign.targetDomains.split(',').map((d) => d.trim())
      : undefined;

    // Get verified + active subscribers
    const where: any = { isVerified: true, isActive: true };
    if (domainFilter && domainFilter.length > 0) {
      where.domain = { in: domainFilter };
    }

    const subscribers = await this.prisma.newsletterSubscriber.findMany({
      where,
      select: { email: true, unsubscribeToken: true, domain: true },
    });

    if (subscribers.length === 0) {
      throw new BadRequestException(
        'Keine verifizierten Empfänger für die gewählten Domains gefunden.',
      );
    }

    // Set status to SENDING
    await this.prisma.newsletterCampaign.update({
      where: { id },
      data: {
        status: 'SENDING',
        totalRecipients: subscribers.length,
        sentCount: 0,
        failedCount: 0,
      },
    });

    this.logger.log(
      `Starte Kampagnen-Versand "${campaign.subject}" an ${subscribers.length} Empfänger`,
    );

    // Send emails (fire-and-forget the whole batch, but track results)
    this.sendBatch(id, campaign.subject, campaign.htmlContent, subscribers).catch(
      (err) => {
        this.logger.error(`Kampagnen-Versand fehlgeschlagen: ${err.message}`);
      },
    );

    return {
      message: `Versand gestartet an ${subscribers.length} Empfänger.`,
      totalRecipients: subscribers.length,
    };
  }

  private async sendBatch(
    campaignId: string,
    subject: string,
    htmlContent: string,
    subscribers: { email: string; unsubscribeToken: string; domain: string }[],
  ) {
    let sentCount = 0;
    let failedCount = 0;

    for (const sub of subscribers) {
      try {
        const success = await this.emailService.sendNewsletterCampaign(
          sub.email,
          subject,
          htmlContent,
          sub.unsubscribeToken,
          sub.domain,
        );
        if (success) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }

      // Update counts every 10 emails
      if ((sentCount + failedCount) % 10 === 0) {
        await this.prisma.newsletterCampaign.update({
          where: { id: campaignId },
          data: { sentCount, failedCount },
        });
      }

      // Small delay to avoid rate limiting (50ms between emails)
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Final update
    await this.prisma.newsletterCampaign.update({
      where: { id: campaignId },
      data: {
        sentCount,
        failedCount,
        status: failedCount === subscribers.length ? 'FAILED' : 'SENT',
        sentAt: new Date(),
      },
    });

    this.logger.log(
      `Kampagne "${subject}" abgeschlossen: ${sentCount} gesendet, ${failedCount} fehlgeschlagen`,
    );
  }
}
