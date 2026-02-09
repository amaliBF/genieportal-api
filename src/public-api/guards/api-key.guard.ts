import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';

// In-memory rate limiter (hourly + daily)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const dailyRateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Plan-based rate limits
const PLAN_RATE_LIMITS: Record<string, { perHour: number; perDay: number }> = {
  FREE: { perHour: 100, perDay: 500 },
  STARTER: { perHour: 1000, perDay: 10000 },
  PRO: { perHour: 5000, perDay: 50000 },
  ENTERPRISE: { perHour: 10000, perDay: 100000 },
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

    // IP Whitelist check
    const allowedIps = apiKey.allowedIps as string[] | null;
    if (allowedIps && allowedIps.length > 0) {
      const clientIp = request.ip?.replace('::ffff:', '') || '';
      if (!allowedIps.includes(clientIp)) {
        throw new ForbiddenException({ error: { code: 'ip_not_allowed', message: 'IP-Adresse nicht erlaubt' } });
      }
    }

    // Domain Whitelist check
    const allowedDomains = apiKey.allowedDomains as string[] | null;
    if (allowedDomains && allowedDomains.length > 0) {
      const origin = request.headers['origin'] || request.headers['referer'] || '';
      const originHost = origin ? (() => { try { return new URL(origin).hostname; } catch { return ''; } })() : '';
      if (originHost && !allowedDomains.some(d => originHost === d || originHost.endsWith('.' + d))) {
        throw new ForbiddenException({ error: { code: 'domain_not_allowed', message: 'Domain nicht erlaubt' } });
      }
    }

    // Plan-based rate limiting
    const plan = (apiKey.company as any)?.subscriptionPlan || 'FREE';
    const planLimits = PLAN_RATE_LIMITS[plan] || PLAN_RATE_LIMITS.FREE;
    const hourlyLimit = apiKey.rateLimit ? Math.min(apiKey.rateLimit, planLimits.perHour) : planLimits.perHour;
    const dailyLimit = planLimits.perDay;

    const now = Date.now();

    // Hourly bucket
    let bucket = rateLimitMap.get(keyHash);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + 3600000 };
      rateLimitMap.set(keyHash, bucket);
    }
    bucket.count++;

    // Daily bucket
    let dailyBucket = dailyRateLimitMap.get(keyHash);
    if (!dailyBucket || now > dailyBucket.resetAt) {
      dailyBucket = { count: 0, resetAt: now + 86400000 };
      dailyRateLimitMap.set(keyHash, dailyBucket);
    }
    dailyBucket.count++;

    const remaining = Math.max(0, hourlyLimit - bucket.count);

    response.setHeader('X-RateLimit-Limit', hourlyLimit.toString());
    response.setHeader('X-RateLimit-Remaining', remaining.toString());
    response.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000).toString());
    response.setHeader('X-RateLimit-Plan', plan);
    response.setHeader('X-RateLimit-Daily-Limit', dailyLimit.toString());
    response.setHeader('X-RateLimit-Daily-Remaining', Math.max(0, dailyLimit - dailyBucket.count).toString());

    if (bucket.count > hourlyLimit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      throw new ForbiddenException({
        error: { code: 'rate_limit_exceeded', message: `Stündliches Rate Limit überschritten. Bitte in ${Math.ceil(retryAfter / 60)} Minuten erneut versuchen.`, retry_after: retryAfter },
      });
    }
    if (dailyBucket.count > dailyLimit) {
      throw new ForbiddenException({
        error: { code: 'daily_rate_limit_exceeded', message: 'Tägliches Rate Limit überschritten.' },
      });
    }

    // Attach to request
    request.apiKey = {
      id: apiKey.id,
      companyId: apiKey.companyId,
      rateLimit: hourlyLimit,
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
