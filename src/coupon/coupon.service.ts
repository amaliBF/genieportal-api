import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // ─── DASHBOARD: Gutschein einlösen ─────────────────────────────────────────

  async redeemCoupon(companyId: string, code: string, ip?: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!coupon) {
      throw new BadRequestException('Ungültiger Gutschein-Code.');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Dieser Gutschein ist nicht mehr aktiv.');
    }

    const now = new Date();
    if (coupon.validFrom > now) {
      throw new BadRequestException('Dieser Gutschein ist noch nicht gültig.');
    }
    if (coupon.validUntil && coupon.validUntil < now) {
      throw new BadRequestException('Dieser Gutschein ist abgelaufen.');
    }

    if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new BadRequestException('Dieser Gutschein wurde bereits vollständig eingelöst.');
    }

    const existing = await this.prisma.couponRedemption.findUnique({
      where: { couponId_companyId: { couponId: coupon.id, companyId } },
    });
    if (existing) {
      throw new ConflictException('Sie haben diesen Gutschein bereits eingelöst.');
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + coupon.durationMonths);

    const result = await this.prisma.$transaction(async (tx) => {
      const redemption = await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          companyId,
          planType: coupon.planType,
          startDate,
          endDate,
          redeemedByIp: ip,
        },
      });

      await tx.coupon.update({
        where: { id: coupon.id },
        data: { redemptionCount: { increment: 1 } },
      });

      await tx.company.update({
        where: { id: companyId },
        data: {
          subscriptionPlan: coupon.planType,
          planValidUntil: endDate,
        },
      });

      return redemption;
    });

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true },
    });

    this.logger.log(
      `Coupon ${coupon.code} eingelöst von ${company?.name} (${companyId}). Plan: ${coupon.planType} bis ${endDate.toISOString()}`,
    );

    return {
      message: `Gutschein erfolgreich eingelöst! Ihr ${coupon.planType}-Plan ist bis zum ${endDate.toLocaleDateString('de-DE')} aktiv.`,
      plan: coupon.planType,
      validUntil: endDate,
      redemption: result,
    };
  }

  // ─── DASHBOARD: Meine Gutschein-Einlösungen ───────────────────────────────

  async getCompanyRedemptions(companyId: string) {
    return this.prisma.couponRedemption.findMany({
      where: { companyId },
      include: {
        coupon: {
          select: { code: true, description: true, campaign: true },
        },
      },
      orderBy: { redeemedAt: 'desc' },
    });
  }

  // ─── ADMIN: Alle Gutscheine auflisten ──────────────────────────────────────

  async findAll(page: number, limit: number, search?: string, isActive?: string) {
    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { description: { contains: search } },
        { campaign: { contains: search } },
      ];
    }

    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;

    const [data, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { redemptions: true } },
        },
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── ADMIN: Einzelner Gutschein mit Einlösungen ────────────────────────────

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        redemptions: {
          include: {
            company: { select: { id: true, name: true, email: true, city: true } },
          },
          orderBy: { redeemedAt: 'desc' },
        },
      },
    });

    if (!coupon) throw new NotFoundException('Gutschein nicht gefunden.');
    return coupon;
  }

  // ─── ADMIN: Gutschein erstellen ────────────────────────────────────────────

  async create(dto: CreateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({
      where: { code: dto.code.toUpperCase().trim() },
    });
    if (existing) {
      throw new ConflictException(`Gutschein-Code "${dto.code}" existiert bereits.`);
    }

    return this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase().trim(),
        planType: (dto.planType as any) || 'PRO',
        durationMonths: dto.durationMonths || 3,
        description: dto.description,
        campaign: dto.campaign,
        maxRedemptions: dto.maxRedemptions,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  // ─── ADMIN: Gutschein bearbeiten ───────────────────────────────────────────

  async update(id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Gutschein nicht gefunden.');

    const data: any = {};
    if (dto.code !== undefined) data.code = dto.code.toUpperCase().trim();
    if (dto.planType !== undefined) data.planType = dto.planType;
    if (dto.durationMonths !== undefined) data.durationMonths = dto.durationMonths;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.campaign !== undefined) data.campaign = dto.campaign;
    if (dto.maxRedemptions !== undefined) data.maxRedemptions = dto.maxRedemptions;
    if (dto.validFrom !== undefined) data.validFrom = new Date(dto.validFrom);
    if (dto.validUntil !== undefined) data.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.coupon.update({ where: { id }, data });
  }

  // ─── ADMIN: Gutschein deaktivieren ─────────────────────────────────────────

  async remove(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Gutschein nicht gefunden.');

    return this.prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── CRON: Abgelaufene Pläne zurücksetzen (täglich 0:00) ──────────────────

  @Cron('0 0 * * *')
  async checkExpiredPlans() {
    this.logger.log('Checking expired plans...');

    const expired = await this.prisma.company.findMany({
      where: {
        planValidUntil: { lt: new Date() },
        subscriptionPlan: { not: 'FREE' },
      },
      select: { id: true, name: true, email: true, subscriptionPlan: true },
    });

    for (const company of expired) {
      await this.prisma.company.update({
        where: { id: company.id },
        data: { subscriptionPlan: 'FREE', planValidUntil: null },
      });

      this.logger.log(`Plan abgelaufen für ${company.name} (${company.id}) → FREE`);

      this.emailService
        .sendPlanExpiredEmail(company.email, company.name)
        .catch(() => {});
    }

    if (expired.length > 0) {
      this.logger.log(`${expired.length} Pläne auf FREE zurückgesetzt.`);
    }
  }

  // ─── CRON: 7-Tage-Warnung vor Ablauf (täglich 8:00) ───────────────────────

  @Cron('0 8 * * *')
  async warnExpiringPlans() {
    this.logger.log('Checking expiring plans (7 days)...');

    const sevenDays = new Date();
    sevenDays.setDate(sevenDays.getDate() + 7);

    const today = new Date();

    const expiring = await this.prisma.company.findMany({
      where: {
        planValidUntil: {
          gt: today,
          lte: sevenDays,
        },
        subscriptionPlan: { not: 'FREE' },
      },
      select: { id: true, name: true, email: true, planValidUntil: true },
    });

    for (const company of expiring) {
      const expiresAt = company.planValidUntil!.toLocaleDateString('de-DE');

      this.emailService
        .sendPlanExpiringEmail(company.email, company.name, expiresAt)
        .catch(() => {});
    }

    if (expiring.length > 0) {
      this.logger.log(`${expiring.length} Ablauf-Warnungen versendet.`);
    }
  }
}
