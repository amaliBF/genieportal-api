import {
  Controller, Get, Post, Delete, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes, createHash } from 'crypto';

@ApiTags('Dashboard - API-Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/api-keys')
export class ApiKeyController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'API-Keys auflisten' })
  async list(@CurrentUser('companyId') companyId: string) {
    return this.prisma.apiKey.findMany({
      where: { companyId },
      select: {
        id: true, name: true, keyPrefix: true, permissions: true,
        rateLimit: true, isActive: true, lastUsedAt: true, expiresAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  @ApiOperation({ summary: 'Neuen API-Key erstellen' })
  async create(
    @CurrentUser('companyId') companyId: string,
    @Body() body: { name: string },
  ) {
    const random = randomBytes(24).toString('hex');
    const key = `gn_${random}`;
    const prefix = key.substring(0, 12);
    const hash = createHash('sha256').update(key).digest('hex');
    const secret = randomBytes(32).toString('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        companyId,
        name: body.name || 'API Key',
        keyPrefix: prefix,
        keyHash: hash,
        permissions: ['read', 'write'],
        rateLimit: 1000,
      },
    });

    // Return the full key ONLY on creation
    return {
      id: apiKey.id,
      name: apiKey.name,
      key, // Full key - shown only once!
      prefix,
      createdAt: apiKey.createdAt,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'API-Key widerrufen' })
  async revoke(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey || apiKey.companyId !== companyId) {
      return { error: 'API-Key nicht gefunden' };
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  }

  @Get('usage')
  @ApiOperation({ summary: 'Nutzungsstatistiken' })
  async usage(@CurrentUser('companyId') companyId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { companyId },
      select: { id: true },
    });
    const keyIds = keys.map(k => k.id);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalRequests = await this.prisma.apiUsageLog.count({
      where: { apiKeyId: { in: keyIds }, createdAt: { gte: thirtyDaysAgo } },
    });

    const byEndpoint = await this.prisma.apiUsageLog.groupBy({
      by: ['endpoint'],
      where: { apiKeyId: { in: keyIds }, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
      orderBy: { _count: { endpoint: 'desc' } },
      take: 10,
    });

    return { totalRequests, period: '30d', byEndpoint };
  }
}
