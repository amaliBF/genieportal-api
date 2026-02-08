import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ─── LOGIN ───────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    const passwordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    const tokens = await this.generateTokens({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin',
    });

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
        lastLoginAt: new Date(),
      },
    });

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      ...tokens,
    };
  }

  // ─── REFRESH TOKENS ──────────────────────────────────────────────────────

  async refreshTokens(refreshToken: string) {
    let payload: { sub: string; email: string; role: string; type: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('ADMIN_JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Ungültiger Refresh Token');
    }

    if (payload.type !== 'admin') {
      throw new UnauthorizedException('Kein Admin Refresh Token');
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });

    if (!admin || !admin.refreshToken) {
      throw new UnauthorizedException('Zugriff verweigert');
    }

    const tokenValid = await bcrypt.compare(refreshToken, admin.refreshToken);
    if (!tokenValid) {
      throw new UnauthorizedException('Zugriff verweigert');
    }

    const tokens = await this.generateTokens({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin',
    });

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    return tokens;
  }

  // ─── CREATE ADMIN ────────────────────────────────────────────────────────

  async createAdmin(
    email: string,
    password: string,
    name: string | undefined,
    role: string | undefined,
    requestingAdminRole: string,
  ) {
    if (requestingAdminRole !== 'superadmin') {
      throw new ForbiddenException(
        'Nur Superadmins können neue Admins erstellen',
      );
    }

    const existing = await this.prisma.adminUser.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('E-Mail ist bereits registriert');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await this.prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        name: name ?? null,
        role: role ?? 'support',
      },
    });

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      createdAt: admin.createdAt,
    };
  }

  // ─── TOKEN GENERATION ───────────────────────────────────────────────────

  private async generateTokens(payload: {
    sub: string;
    email: string;
    role: string;
    type: string;
  }) {
    const secret = this.configService.get<string>('ADMIN_JWT_SECRET');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret,
        expiresIn: '30m',
      }),
      this.jwtService.signAsync(payload, {
        secret,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
