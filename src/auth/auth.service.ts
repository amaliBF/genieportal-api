import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SignupDto, AccountType } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  // ─── SIGNUP ──────────────────────────────────────────────────────────────

  async signup(dto: SignupDto) {
    if (dto.accountType === AccountType.COMPANY) {
      return this.signupCompany(dto);
    }
    return this.signupUser(dto);
  }

  private async signupUser(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('E-Mail ist bereits registriert');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const emailVerifyToken = uuidv4();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        emailVerifyToken,
      },
    });

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      type: 'user',
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
    });

    // Send verification email (non-blocking)
    this.emailService
      .sendVerificationEmail(user.email, user.firstName || 'dort', emailVerifyToken)
      .catch(() => {});

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      ...tokens,
    };
  }

  private async signupCompany(dto: SignupDto) {
    if (!dto.companyName) {
      throw new BadRequestException('Firmenname ist erforderlich');
    }

    const existing = await this.prisma.companyUser.findFirst({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('E-Mail ist bereits registriert');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const emailVerifyToken = uuidv4();

    const slug = dto.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existingSlug = await this.prisma.company.findUnique({
      where: { slug },
    });
    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        slug: finalSlug,
        email: dto.email,
        postalCode: dto.postalCode ?? '00000',
        city: dto.city ?? '',
        companyUsers: {
          create: {
            email: dto.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            role: 'owner',
            canEditProfile: true,
            canManageJobs: true,
            canChat: true,
            canManageTeam: true,
            canManageBilling: true,
            emailVerifyToken,
          },
        },
      },
      include: { companyUsers: true },
    });

    const companyUser = company.companyUsers[0];

    const tokens = await this.generateTokens({
      sub: companyUser.id,
      email: companyUser.email,
      type: 'company',
      companyId: company.id,
    });

    await this.prisma.companyUser.update({
      where: { id: companyUser.id },
      data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
    });

    // Send verification email (non-blocking)
    this.emailService
      .sendVerificationEmail(companyUser.email, companyUser.firstName || 'dort', emailVerifyToken)
      .catch(() => {});

    // Send admin notification email (non-blocking)
    const adminEmail = this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL');
    if (adminEmail) {
      this.emailService
        .sendAdminNewRegistrationEmail(
          adminEmail,
          dto.companyName,
          dto.email,
          dto.city || '',
          'FREE',
        )
        .catch(() => {});
    }

    return {
      user: {
        id: companyUser.id,
        email: companyUser.email,
        firstName: companyUser.firstName,
        lastName: companyUser.lastName,
        role: companyUser.role,
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
      ...tokens,
    };
  }

  // ─── LOGIN ───────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    if (dto.accountType === AccountType.COMPANY) {
      return this.loginCompany(dto);
    }
    return this.loginUser(dto);
  }

  private async loginUser(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      type: 'user',
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
        lastActiveAt: new Date(),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        profileComplete: user.profileComplete,
      },
      ...tokens,
    };
  }

  private async loginCompany(dto: LoginDto) {
    const companyUser = await this.prisma.companyUser.findFirst({
      where: { email: dto.email },
      include: { company: true },
    });
    if (!companyUser) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      companyUser.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    const tokens = await this.generateTokens({
      sub: companyUser.id,
      email: companyUser.email,
      type: 'company',
      companyId: companyUser.companyId,
    });

    await this.prisma.companyUser.update({
      where: { id: companyUser.id },
      data: {
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
        lastLoginAt: new Date(),
      },
    });

    return {
      user: {
        id: companyUser.id,
        email: companyUser.email,
        firstName: companyUser.firstName,
        lastName: companyUser.lastName,
        role: companyUser.role,
      },
      company: {
        id: companyUser.company.id,
        name: companyUser.company.name,
        slug: companyUser.company.slug,
        status: companyUser.company.status,
      },
      ...tokens,
    };
  }

  // ─── LOGOUT ──────────────────────────────────────────────────────────────

  async logout(userId: string, userType: string) {
    if (userType === 'company') {
      await this.prisma.companyUser.update({
        where: { id: userId },
        data: { refreshToken: null },
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null },
      });
    }
    return { message: 'Erfolgreich abgemeldet' };
  }

  // ─── REFRESH TOKEN ───────────────────────────────────────────────────────

  async refreshTokens(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Ungültiger Refresh Token');
    }

    if (payload.type === 'company') {
      const companyUser = await this.prisma.companyUser.findUnique({
        where: { id: payload.sub },
      });
      if (!companyUser || !companyUser.refreshToken) {
        throw new UnauthorizedException('Zugriff verweigert');
      }

      const tokenValid = await bcrypt.compare(
        refreshToken,
        companyUser.refreshToken,
      );
      if (!tokenValid) {
        throw new UnauthorizedException('Zugriff verweigert');
      }

      const tokens = await this.generateTokens({
        sub: companyUser.id,
        email: companyUser.email,
        type: 'company',
        companyId: companyUser.companyId,
      });

      await this.prisma.companyUser.update({
        where: { id: companyUser.id },
        data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
      });

      return tokens;
    } else {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Zugriff verweigert');
      }

      const tokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!tokenValid) {
        throw new UnauthorizedException('Zugriff verweigert');
      }

      const tokens = await this.generateTokens({
        sub: user.id,
        email: user.email,
        type: 'user',
      });

      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: await bcrypt.hash(tokens.refreshToken, 10) },
      });

      return tokens;
    }
  }

  // ─── FORGOT PASSWORD ────────────────────────────────────────────────────

  async forgotPassword(email: string, accountType: AccountType) {
    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    if (accountType === AccountType.COMPANY) {
      const companyUser = await this.prisma.companyUser.findFirst({
        where: { email },
      });
      if (companyUser) {
        await this.prisma.companyUser.update({
          where: { id: companyUser.id },
          data: {
            passwordResetToken: resetToken,
            passwordResetExpires: resetExpires,
          },
        });
        // Send reset email (non-blocking)
        this.emailService
          .sendPasswordResetEmail(email, companyUser.firstName || 'dort', resetToken)
          .catch(() => {});
      }
    } else {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetToken: resetToken,
            passwordResetExpires: resetExpires,
          },
        });
        // Send reset email (non-blocking)
        this.emailService
          .sendPasswordResetEmail(email, user.firstName || 'dort', resetToken)
          .catch(() => {});
      }
    }

    // Always return success to prevent email enumeration
    return { message: 'Falls ein Account existiert, wurde eine E-Mail gesendet' };
  }

  // ─── RESET PASSWORD ─────────────────────────────────────────────────────

  async resetPassword(token: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Check users
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
          refreshToken: null,
        },
      });
      return { message: 'Passwort erfolgreich zurückgesetzt' };
    }

    // Check company users
    const companyUser = await this.prisma.companyUser.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (companyUser) {
      await this.prisma.companyUser.update({
        where: { id: companyUser.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
          refreshToken: null,
        },
      });
      return { message: 'Passwort erfolgreich zurückgesetzt' };
    }

    throw new BadRequestException('Token ungültig oder abgelaufen');
  }

  // ─── VERIFY EMAIL ───────────────────────────────────────────────────────

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, emailVerifyToken: null },
      });
      // Send welcome email (non-blocking)
      this.emailService
        .sendWelcomeEmail(user.email, user.firstName || 'dort')
        .catch(() => {});
      return { message: 'E-Mail erfolgreich verifiziert' };
    }

    const companyUser = await this.prisma.companyUser.findFirst({
      where: { emailVerifyToken: token },
    });

    if (companyUser) {
      await this.prisma.companyUser.update({
        where: { id: companyUser.id },
        data: { emailVerified: true, emailVerifyToken: null },
      });
      // Send welcome email (non-blocking)
      this.emailService
        .sendWelcomeEmail(companyUser.email, companyUser.firstName || 'dort')
        .catch(() => {});
      return { message: 'E-Mail erfolgreich verifiziert' };
    }

    throw new BadRequestException('Token ungültig');
  }

  // ─── RESEND VERIFICATION ───────────────────────────────────────────────

  async resendVerification(email: string) {
    const newToken = uuidv4();

    // Check users
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifyToken: newToken },
      });
      this.emailService
        .sendVerificationEmail(user.email, user.firstName || 'dort', newToken)
        .catch(() => {});
    }

    // Check company users
    const companyUser = await this.prisma.companyUser.findFirst({
      where: { email },
    });
    if (companyUser && !companyUser.emailVerified) {
      await this.prisma.companyUser.update({
        where: { id: companyUser.id },
        data: { emailVerifyToken: newToken },
      });
      this.emailService
        .sendVerificationEmail(companyUser.email, companyUser.firstName || 'dort', newToken)
        .catch(() => {});
    }

    // Always return success to prevent email enumeration
    return { message: 'Falls die E-Mail nicht verifiziert ist, wurde ein neuer Link gesendet' };
  }

  // ─── GET CURRENT USER ───────────────────────────────────────────────────

  async getMe(userId: string, userType: string) {
    if (userType === 'company') {
      const companyUser = await this.prisma.companyUser.findUnique({
        where: { id: userId },
        include: { company: true },
      });
      if (!companyUser) throw new NotFoundException('Benutzer nicht gefunden');

      return {
        id: companyUser.id,
        email: companyUser.email,
        firstName: companyUser.firstName,
        lastName: companyUser.lastName,
        role: companyUser.role,
        emailVerified: companyUser.emailVerified,
        type: 'company',
        company: {
          id: companyUser.company.id,
          name: companyUser.company.name,
          slug: companyUser.company.slug,
          status: companyUser.company.status,
          verified: companyUser.company.verified,
        },
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      profileComplete: user.profileComplete,
      type: 'user',
    };
  }

  // ─── TOKEN GENERATION ───────────────────────────────────────────────────

  private async generateTokens(payload: {
    sub: string;
    email: string;
    type: string;
    companyId?: string;
  }) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION') || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION') || '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
