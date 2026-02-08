import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Kein Admin-Token vorhanden');
    }

    const token = authHeader.substring(7);

    let payload: { sub: string; email: string; role: string; type: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('ADMIN_JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Ungültiger oder abgelaufener Admin-Token');
    }

    if (payload.type !== 'admin') {
      throw new UnauthorizedException('Kein Admin-Token');
    }

    const adminUser = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });

    if (!adminUser) {
      throw new UnauthorizedException('Admin-Benutzer nicht gefunden');
    }

    request.adminUser = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      permissions: adminUser.permissions,
    };

    return true;
  }
}
