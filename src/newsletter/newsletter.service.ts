import {
  Injectable,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // ─── SUBSCRIBE (Double-Opt-In) ──────────────────────────────────────────────

  async subscribe(dto: SubscribeNewsletterDto) {
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email_domain: { email: dto.email, domain: dto.domain } },
    });

    // Already verified & active
    if (existing && existing.isVerified && existing.isActive) {
      throw new ConflictException(
        'Du bist bereits für den Newsletter angemeldet.',
      );
    }

    // Exists but not verified → resend verification
    if (existing && !existing.isVerified) {
      const verifyToken = randomBytes(32).toString('hex');
      await this.prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { verifyToken },
      });
      this.emailService
        .sendNewsletterVerification(dto.email, verifyToken, dto.domain)
        .catch(() => {});
      return {
        message:
          'Bestätigungslink wurde erneut gesendet. Bitte prüfe dein Postfach.',
      };
    }

    // Exists but was unsubscribed → reactivate
    if (existing && !existing.isActive) {
      const verifyToken = randomBytes(32).toString('hex');
      await this.prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { verifyToken, isActive: true, isVerified: false },
      });
      this.emailService
        .sendNewsletterVerification(dto.email, verifyToken, dto.domain)
        .catch(() => {});
      return {
        message:
          'Fast geschafft! Bitte bestätige deine E-Mail-Adresse.',
      };
    }

    // New subscription
    const verifyToken = randomBytes(32).toString('hex');
    const unsubscribeToken = randomBytes(32).toString('hex');

    await this.prisma.newsletterSubscriber.create({
      data: {
        email: dto.email,
        domain: dto.domain,
        verifyToken,
        unsubscribeToken,
        isVerified: false,
      },
    });

    // Send verification email (fire-and-forget)
    this.emailService
      .sendNewsletterVerification(dto.email, verifyToken, dto.domain)
      .catch(() => {});

    // Notify admin
    this.emailService
      .sendAdminNewsletterNotification(dto.email, dto.domain)
      .catch(() => {});

    return {
      message: 'Fast geschafft! Bitte bestätige deine E-Mail-Adresse.',
    };
  }

  // ─── VERIFY ─────────────────────────────────────────────────────────────────

  async verify(token: string): Promise<{ url: string; statusCode: number }> {
    const subscriber = await this.prisma.newsletterSubscriber.findFirst({
      where: { verifyToken: token },
    });

    if (!subscriber) {
      return {
        url: 'https://genieportal.de/?error=invalid-token',
        statusCode: 302,
      };
    }

    const domain = subscriber.domain || 'genieportal.de';

    if (subscriber.isVerified) {
      return { url: `https://${domain}/newsletter/bestaetigt`, statusCode: 302 };
    }

    await this.prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { isVerified: true, verifyToken: null, verifiedAt: new Date() },
    });

    // Send welcome/confirmation email
    this.emailService
      .sendNewsletterWelcome(subscriber.email, subscriber.domain)
      .catch(() => {});

    this.logger.log(
      `Newsletter verifiziert: ${subscriber.email} (${subscriber.domain})`,
    );

    return { url: `https://${domain}/newsletter/bestaetigt`, statusCode: 302 };
  }

  // ─── UNSUBSCRIBE ────────────────────────────────────────────────────────────

  async unsubscribe(token: string): Promise<{ url: string; statusCode: number }> {
    const subscriber = await this.prisma.newsletterSubscriber.findFirst({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      return {
        url: 'https://genieportal.de/?error=invalid-token',
        statusCode: 302,
      };
    }

    const domain = subscriber.domain || 'genieportal.de';

    await this.prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { isActive: false },
    });

    return { url: `https://${domain}/newsletter/abgemeldet`, statusCode: 302 };
  }
}
