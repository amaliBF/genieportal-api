import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Plan-based rate limits (requests per hour)
const PLAN_RATE_LIMITS: Record<string, number> = {
  FREE: 100,
  STARTER: 500,
  PRO: 2000,
  ENTERPRISE: 10000,
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const key = this.extractKey(request);
    if (!key) throw new UnauthorizedException('API-Key erforderlich');

    const keyHash = createHash('sha256').update(key).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        company: {
          select: { subscriptionPlan: true },
        },
      },
    });

    if (!apiKey) throw new UnauthorizedException('Ungültiger API-Key');
    if (!apiKey.isActive) throw new UnauthorizedException('API-Key deaktiviert');
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      throw new UnauthorizedException('API-Key abgelaufen');
    }

    // Permissions check
    const method = request.method;
    const permissions = (apiKey.permissions as string[]) || ['read', 'write'];
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !permissions.includes('write')) {
      throw new ForbiddenException('API-Key hat keine Schreibberechtigung');
    }
    if (method === 'GET' && !permissions.includes('read')) {
      throw new ForbiddenException('API-Key hat keine Leseberechtigung');
    }

    // Plan-based rate limiting
    const plan = (apiKey.company as any)?.subscriptionPlan || 'FREE';
    const planLimit = PLAN_RATE_LIMITS[plan] || PLAN_RATE_LIMITS.FREE;
    const limit = apiKey.rateLimit ? Math.min(apiKey.rateLimit, planLimit) : planLimit;

    const now = Date.now();
    const windowMs = 3600000; // 1 hour
    let bucket = rateLimitMap.get(keyHash);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      rateLimitMap.set(keyHash, bucket);
    }
    bucket.count++;

    const remaining = Math.max(0, limit - bucket.count);

    response.setHeader('X-RateLimit-Limit', limit.toString());
    response.setHeader('X-RateLimit-Remaining', remaining.toString());
    response.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000).toString());
    response.setHeader('X-RateLimit-Plan', plan);

    if (bucket.count > limit) {
      throw new UnauthorizedException('Rate Limit überschritten');
    }

    // Attach to request
    request.apiKey = {
      id: apiKey.id,
      companyId: apiKey.companyId,
      rateLimit: limit,
      permissions,
      plan,
    };

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
    if (request.query?.key?.startsWith('gn_')) {
      return request.query.key;
    }
    return null;
  }
}
