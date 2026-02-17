import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
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
        'Du bist bereits fuer den Newsletter angemeldet.',
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
          'Bestaetigungslink wurde erneut gesendet. Bitte pruefe dein Postfach.',
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
          'Fast geschafft! Bitte bestaetige deine E-Mail-Adresse.',
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
      message: 'Fast geschafft! Bitte bestaetige deine E-Mail-Adresse.',
    };
  }

  // ─── VERIFY ─────────────────────────────────────────────────────────────────

  async verify(token: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findFirst({
      where: { verifyToken: token },
    });

    if (!subscriber) {
      throw new NotFoundException(
        'Ungueltiger oder abgelaufener Bestaetigungs-Link.',
      );
    }

    if (subscriber.isVerified) {
      return { message: 'E-Mail-Adresse wurde bereits bestaetigt.' };
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

    return {
      message: 'Danke! Du wirst benachrichtigt, sobald die App verfuegbar ist.',
    };
  }

  // ─── UNSUBSCRIBE ────────────────────────────────────────────────────────────

  async unsubscribe(token: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findFirst({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      throw new NotFoundException('Ungueltiger Abmelde-Link.');
    }

    await this.prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { isActive: false },
    });

    return { message: 'Du wurdest erfolgreich abgemeldet.' };
  }
}
