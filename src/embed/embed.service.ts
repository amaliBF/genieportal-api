import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';
import { jobListTemplate } from './templates/job-list.template';
import { jobDetailTemplate } from './templates/job-detail.template';
import { applyFormTemplate } from './templates/apply-form.template';

@Injectable()
export class EmbedService {
  constructor(private prisma: PrismaService) {}

  private async validateKey(key: string) {
    if (!key?.startsWith('gn_')) throw new UnauthorizedException('Ungültiger API-Key');
    const keyHash = createHash('sha256').update(key).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!apiKey || !apiKey.isActive) throw new UnauthorizedException('API-Key ungültig oder deaktiviert');
    return apiKey.companyId;
  }

  async getJobListHtml(key: string, options: {
    theme?: string; color?: string; limit?: number;
    layout?: string; bereich?: string; showFilters?: boolean;
  }) {
    const companyId = await this.validateKey(key);
    const where: any = { companyId, status: 'ACTIVE' };
    if (options.bereich) where.bereich = options.bereich;

    const jobs = await this.prisma.jobPost.findMany({
      where,
      select: { id: true, title: true, slug: true, city: true, postalCode: true, salaryYear1: true },
      orderBy: { publishedAt: 'desc' },
      take: options.limit || 10,
    });

    return jobListTemplate(jobs, {
      theme: options.theme || 'light',
      color: options.color || '#6366f1',
      apiUrl: 'https://api.genieportal.de',
      layout: options.layout || 'list',
      bereich: options.bereich,
      showFilters: options.showFilters || false,
    });
  }

  async getJobDetailHtml(key: string, jobId: string, options: {
    theme?: string; color?: string; showApply?: boolean; applyText?: string;
  }) {
    const companyId = await this.validateKey(key);
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
      include: { company: { select: { name: true, city: true, logoUrl: true } } },
    });
    if (!job || job.companyId !== companyId) throw new NotFoundException('Stelle nicht gefunden');

    return jobDetailTemplate(job, job.company, {
      theme: options.theme || 'light',
      color: options.color || '#6366f1',
      showApply: options.showApply !== false,
      applyText: options.applyText,
    });
  }

  async getApplyFormHtml(key: string, jobId: string, options: { theme?: string; color?: string }) {
    const companyId = await this.validateKey(key);
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, companyId: true, company: { select: { name: true } } },
    });
    if (!job || job.companyId !== companyId) throw new NotFoundException('Stelle nicht gefunden');

    const config = await this.prisma.applicationFormConfig.findUnique({
      where: { companyId },
    });

    return applyFormTemplate(job, job.company, config, {
      theme: options.theme || 'light',
      color: options.color || '#6366f1',
      apiUrl: 'https://api.genieportal.de',
    });
  }
}
