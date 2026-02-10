import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private readonly refreshSecret: string;
  private readonly accessExpiration: string;
  private readonly refreshExpirationDays = 30;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    this.refreshSecret =
      this.configService.get('SSO_JWT_REFRESH_SECRET') || '';
    this.accessExpiration = '15m';
  }

  // ─── REGISTER ───────────────────────────────────────────────────────────────

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
    domain: string;
    newsletterConsent?: boolean;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Ein Konto mit dieser E-Mail existiert bereits.');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');

    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName || null,
        emailVerifyToken,
        ssoEnabled: true,
        registeredVia: data.domain,
        lastLoginDomain: data.domain,
        activeDomains: [data.domain],
        newsletterConsent: data.newsletterConsent || false,
        newsletterConsentAt: data.newsletterConsent ? new Date() : null,
      },
    });

    // Fire-and-forget: Send verification email
    this.emailService
      .sendSsoVerificationEmail(
        user.email,
        user.firstName,
        emailVerifyToken,
        data.domain,
      )
      .catch(() => {});

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ─── LOGIN ──────────────────────────────────────────────────────────────────

  async login(data: { email: string; password: string; domain: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user || !user.ssoEnabled) {
      throw new UnauthorizedException('E-Mail oder Passwort ist falsch.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Dein Konto ist deaktiviert.');
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('E-Mail oder Passwort ist falsch.');
    }

    // Update last login domain & active domains
    const currentDomains = (user.activeDomains as string[]) || [];
    const activeDomains = currentDomains.includes(data.domain)
      ? currentDomains
      : [...currentDomains, data.domain];

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginDomain: data.domain,
        activeDomains,
        lastActiveAt: new Date(),
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ─── LOGOUT ─────────────────────────────────────────────────────────────────

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.ssoRefreshToken
        .deleteMany({ where: { userId, token: refreshToken } })
        .catch(() => {});
    }
  }

  // ─── REFRESH ────────────────────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Kein Refresh-Token vorhanden.');
    }

    const stored = await this.prisma.ssoRefreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      // Token invalid or expired - clean up
      if (stored) {
        await this.prisma.ssoRefreshToken
          .delete({ where: { id: stored.id } })
          .catch(() => {});
      }
      throw new UnauthorizedException('Refresh-Token ist ungültig oder abgelaufen.');
    }

    if (stored.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Dein Konto ist deaktiviert.');
    }

    // Token rotation: Delete old, create new
    await this.prisma.ssoRefreshToken
      .delete({ where: { id: stored.id } })
      .catch(() => {});

    const tokens = await this.generateTokens(
      stored.user.id,
      stored.user.email,
    );

    return {
      user: this.sanitizeUser(stored.user),
      ...tokens,
    };
  }

  // ─── FORGOT PASSWORD ───────────────────────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success (don't reveal if email exists)
    if (!user || !user.ssoEnabled) return;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    this.emailService
      .sendSsoPasswordResetEmail(user.email, user.firstName, resetToken)
      .catch(() => {});
  }

  // ─── RESET PASSWORD ────────────────────────────────────────────────────────

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
        ssoEnabled: true,
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all refresh tokens
    await this.prisma.ssoRefreshToken
      .deleteMany({ where: { userId: user.id } })
      .catch(() => {});

    this.emailService
      .sendPasswordChangedEmail(user.email, user.firstName)
      .catch(() => {});
  }

  // ─── VERIFY EMAIL ──────────────────────────────────────────────────────────

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token, ssoEnabled: true },
    });

    if (!user) {
      throw new BadRequestException('Ungültiger Bestätigungslink.');
    }

    if (user.emailVerified) {
      return { alreadyVerified: true, domain: user.registeredVia };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
      },
    });

    // Fire-and-forget: Send welcome email
    this.emailService
      .sendSsoWelcomeEmail(user.email, user.firstName)
      .catch(() => {});

    return { alreadyVerified: false, domain: user.registeredVia };
  }

  // ─── GET ME ─────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Benutzer nicht gefunden.');
    }

    return this.sanitizeUser(user);
  }

  // ─── UPDATE PROFILE ─────────────────────────────────────────────────────────

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      lifePhase?: string;
      interests?: string[];
    },
  ) {
    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.lifePhase !== undefined) updateData.lifePhase = data.lifePhase;
    if (data.interests !== undefined) updateData.interests = data.interests;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this.sanitizeUser(user);
  }

  // ─── DELETE ACCOUNT (DSGVO) ─────────────────────────────────────────────────

  async deleteAccount(userId: string) {
    // Delete all refresh tokens
    await this.prisma.ssoRefreshToken
      .deleteMany({ where: { userId } })
      .catch(() => {});

    // Anonymize user data
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted_${userId}@deleted.local`,
        passwordHash: '',
        firstName: 'Gelöscht',
        lastName: null,
        phone: null,
        bio: null,
        avatarUrl: null,
        status: 'DELETED',
        ssoEnabled: false,
        emailVerified: false,
        deletedAt: new Date(),
      },
    });
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  private async generateTokens(userId: string, email: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId, email },
      { expiresIn: 900 }, // 15 minutes in seconds
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(
      Date.now() + this.refreshExpirationDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.ssoRefreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      lifePhase: user.lifePhase,
      interests: user.interests,
      activeDomains: user.activeDomains,
      emailVerified: user.emailVerified,
    };
  }
}
