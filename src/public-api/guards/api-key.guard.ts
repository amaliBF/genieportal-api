import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const key = this.extractKey(request);
    if (!key) throw new UnauthorizedException('API-Key erforderlich');

    const keyHash = createHash('sha256').update(key).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({ where: { keyHash } });

    if (!apiKey) throw new UnauthorizedException('Ungültiger API-Key');
    if (!apiKey.isActive) throw new UnauthorizedException('API-Key deaktiviert');
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      throw new UnauthorizedException('API-Key abgelaufen');
    }

    // Rate limiting
    const now = Date.now();
    const windowMs = 3600000; // 1 hour
    let bucket = rateLimitMap.get(keyHash);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      rateLimitMap.set(keyHash, bucket);
    }
    bucket.count++;

    const limit = apiKey.rateLimit || 1000;
    const remaining = Math.max(0, limit - bucket.count);

    response.setHeader('X-RateLimit-Limit', limit.toString());
    response.setHeader('X-RateLimit-Remaining', remaining.toString());
    response.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000).toString());

    if (bucket.count > limit) {
      throw new UnauthorizedException('Rate Limit überschritten');
    }

    // Attach to request
    request.apiKey = { id: apiKey.id, companyId: apiKey.companyId, rateLimit: apiKey.rateLimit };

    // Async: update lastUsedAt + log usage
    const startTime = Date.now();
    response.on('finish', () => {
      this.prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});

      this.prisma.apiUsageLog.create({
        data: {
          apiKeyId: apiKey.id,
          endpoint: request.url,
          method: request.method,
          statusCode: response.statusCode,
          ip: request.ip,
          responseTimeMs: Date.now() - startTime,
        },
      }).catch(() => {});
    });

    return true;
  }

  private extractKey(request: any): string | null {
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer gn_')) {
      return authHeader.substring(7);
    }
    if (request.query?.api_key?.startsWith('gn_')) {
      return request.query.api_key;
    }
    return null;
  }
}
