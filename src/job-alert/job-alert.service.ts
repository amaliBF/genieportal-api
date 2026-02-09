import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateJobAlertDto } from './dto/create-job-alert.dto';
import { UpdateJobAlertDto } from './dto/update-job-alert.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class JobAlertService {
  private readonly logger = new Logger(JobAlertService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // ─── PUBLIC (kein Login nötig) ──────────────────────────────────────────────

  async createPublic(dto: CreateJobAlertDto) {
    // Check if alert with same email + similar criteria already exists
    const existing = await this.prisma.jobAlert.findFirst({
      where: {
        email: dto.email,
        keywords: dto.keywords || null,
        bereich: dto.bereich || null,
        city: dto.city || null,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException('Ein ähnlicher Job-Alert existiert bereits für diese E-Mail-Adresse.');
    }

    const verifyToken = randomBytes(32).toString('hex');
    const unsubscribeToken = randomBytes(32).toString('hex');

    const alert = await this.prisma.jobAlert.create({
      data: {
        email: dto.email,
        name: dto.name,
        keywords: dto.keywords,
        bereich: dto.bereich,
        postalCode: dto.postalCode,
        city: dto.city,
        radiusKm: dto.radiusKm ?? 50,
        remote: dto.remote,
        frequency: (dto.frequency as any) || 'DAILY',
        verifyToken,
        unsubscribeToken,
        isVerified: false,
      },
    });

    // Send verification email (fire-and-forget)
    this.emailService.sendJobAlertVerification(dto.email, verifyToken, dto.keywords || dto.city || 'neue Stellen').catch(() => {});

    return {
      message: 'Job-Alert erstellt! Bitte bestätige deine E-Mail-Adresse.',
      id: alert.id,
    };
  }

  async verify(token: string) {
    const alert = await this.prisma.jobAlert.findFirst({
      where: { verifyToken: token },
    });

    if (!alert) {
      throw new NotFoundException('Ungültiger oder abgelaufener Bestätigungs-Link.');
    }

    if (alert.isVerified) {
      return { message: 'E-Mail-Adresse wurde bereits bestätigt.' };
    }

    await this.prisma.jobAlert.update({
      where: { id: alert.id },
      data: { isVerified: true, verifyToken: null },
    });

    return { message: 'E-Mail-Adresse erfolgreich bestätigt! Du erhältst ab jetzt Job-Alerts.' };
  }

  async unsubscribe(token: string) {
    const alert = await this.prisma.jobAlert.findFirst({
      where: { unsubscribeToken: token },
    });

    if (!alert) {
      throw new NotFoundException('Ungültiger Abmelde-Link.');
    }

    await this.prisma.jobAlert.update({
      where: { id: alert.id },
      data: { isActive: false },
    });

    return { message: 'Job-Alert erfolgreich abbestellt.' };
  }

  // ─── USER (mit Login) ───────────────────────────────────────────────────────

  async createForUser(userId: string, dto: CreateJobAlertDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden.');

    const unsubscribeToken = randomBytes(32).toString('hex');

    const alert = await this.prisma.jobAlert.create({
      data: {
        userId,
        email: dto.email || user.email,
        name: dto.name,
        keywords: dto.keywords,
        bereich: dto.bereich,
        postalCode: dto.postalCode,
        city: dto.city,
        radiusKm: dto.radiusKm ?? 50,
        remote: dto.remote,
        frequency: (dto.frequency as any) || 'DAILY',
        unsubscribeToken,
        isVerified: true, // User already verified via login
      },
    });

    return alert;
  }

  async findByUser(userId: string) {
    return this.prisma.jobAlert.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(userId: string, alertId: string, dto: UpdateJobAlertDto) {
    const alert = await this.prisma.jobAlert.findFirst({
      where: { id: alertId, userId },
    });

    if (!alert) throw new NotFoundException('Job-Alert nicht gefunden.');

    return this.prisma.jobAlert.update({
      where: { id: alertId },
      data: {
        name: dto.name,
        keywords: dto.keywords,
        bereich: dto.bereich,
        postalCode: dto.postalCode,
        city: dto.city,
        radiusKm: dto.radiusKm,
        remote: dto.remote,
        frequency: dto.frequency as any,
        isActive: dto.isActive,
      },
    });
  }

  async delete(userId: string, alertId: string) {
    const alert = await this.prisma.jobAlert.findFirst({
      where: { id: alertId, userId },
    });

    if (!alert) throw new NotFoundException('Job-Alert nicht gefunden.');

    await this.prisma.jobAlert.delete({ where: { id: alertId } });

    return { message: 'Job-Alert gelöscht.' };
  }

  // ─── CRON: DAILY ALERTS (8:00 Uhr) ──────────────────────────────────────────

  @Cron('0 8 * * *')
  async sendDailyAlerts() {
    this.logger.log('Starte täglichen Job-Alert-Versand...');

    const alerts = await this.prisma.jobAlert.findMany({
      where: {
        isActive: true,
        isVerified: true,
        frequency: 'DAILY',
      },
    });

    let sentCount = 0;

    for (const alert of alerts) {
      try {
        const newJobs = await this.findNewJobsForAlert(alert);

        if (newJobs.length > 0) {
          await this.emailService.sendJobAlertDigest(
            alert.email,
            alert.keywords || alert.city || 'Neue Stellen',
            newJobs,
            alert.unsubscribeToken,
          ).catch(() => {});

          await this.prisma.jobAlert.update({
            where: { id: alert.id },
            data: {
              lastSentAt: new Date(),
              sentCount: { increment: 1 },
              matchCount: newJobs.length,
            },
          });

          sentCount++;
        }
      } catch (error) {
        this.logger.error(`Fehler bei Alert ${alert.id}: ${error.message}`);
      }
    }

    this.logger.log(`Tägliche Job-Alerts versendet: ${sentCount}/${alerts.length}`);
  }

  // ─── CRON: INSTANT ALERTS (stündlich) ────────────────────────────────────────

  @Cron('0 * * * *')
  async sendInstantAlerts() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const alerts = await this.prisma.jobAlert.findMany({
      where: {
        isActive: true,
        isVerified: true,
        frequency: 'INSTANT',
        OR: [
          { lastSentAt: null },
          { lastSentAt: { lt: oneHourAgo } },
        ],
      },
    });

    for (const alert of alerts) {
      try {
        const sinceDate = alert.lastSentAt || new Date(Date.now() - 60 * 60 * 1000);
        const newJobs = await this.findNewJobsForAlert(alert, sinceDate);

        if (newJobs.length > 0) {
          await this.emailService.sendJobAlertDigest(
            alert.email,
            alert.keywords || alert.city || 'Neue Stellen',
            newJobs,
            alert.unsubscribeToken,
          ).catch(() => {});

          await this.prisma.jobAlert.update({
            where: { id: alert.id },
            data: {
              lastSentAt: new Date(),
              sentCount: { increment: 1 },
              matchCount: newJobs.length,
            },
          });
        }
      } catch (error) {
        this.logger.error(`Fehler bei Instant-Alert ${alert.id}: ${error.message}`);
      }
    }
  }

  // ─── CRON: WEEKLY ALERTS (Sonntag 10:00 Uhr) ────────────────────────────────

  @Cron('0 10 * * 0')
  async sendWeeklyAlerts() {
    this.logger.log('Starte wöchentlichen Job-Alert-Versand...');

    const alerts = await this.prisma.jobAlert.findMany({
      where: {
        isActive: true,
        isVerified: true,
        frequency: 'WEEKLY',
      },
    });

    for (const alert of alerts) {
      try {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const newJobs = await this.findNewJobsForAlert(alert, oneWeekAgo);

        if (newJobs.length > 0) {
          await this.emailService.sendJobAlertDigest(
            alert.email,
            alert.keywords || alert.city || 'Neue Stellen',
            newJobs,
            alert.unsubscribeToken,
          ).catch(() => {});

          await this.prisma.jobAlert.update({
            where: { id: alert.id },
            data: {
              lastSentAt: new Date(),
              sentCount: { increment: 1 },
              matchCount: newJobs.length,
            },
          });
        }
      } catch (error) {
        this.logger.error(`Fehler bei Weekly-Alert ${alert.id}: ${error.message}`);
      }
    }
  }

  // ─── HELPER: Passende Jobs finden ───────────────────────────────────────────

  private async findNewJobsForAlert(alert: any, since?: Date): Promise<any[]> {
    const sinceDate = since || alert.lastSentAt || new Date(Date.now() - 24 * 60 * 60 * 1000);

    const where: any = {
      status: 'ACTIVE',
      publishedAt: { gte: sinceDate },
    };

    if (alert.keywords) {
      where.OR = [
        { title: { contains: alert.keywords } },
        { beruf: { contains: alert.keywords } },
        { description: { contains: alert.keywords } },
      ];
    }

    if (alert.bereich) {
      where.bereich = alert.bereich;
    }

    if (alert.city) {
      where.city = { contains: alert.city };
    }

    if (alert.postalCode) {
      where.postalCode = { startsWith: alert.postalCode.substring(0, 2) };
    }

    if (alert.remote === true) {
      where.remote = true;
    }

    return this.prisma.jobPost.findMany({
      where,
      include: {
        company: { select: { name: true, slug: true, city: true, logoUrl: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    });
  }
}
