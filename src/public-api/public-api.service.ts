import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicApiService {
  constructor(private prisma: PrismaService) {}

  private generateSlug(title: string): string {
    return title.toLowerCase()
      .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140);
  }

  // ─── Jobs ─────────────────────────────────────────────────────────────────

  async listJobs(companyId: string, page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = { companyId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.jobPost.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, slug: true, status: true,
          city: true, postalCode: true, salaryYear1: true, salaryYear2: true, salaryYear3: true,
          startDate: true, durationMonths: true, positionsAvailable: true,
          showOnWebsite: true, viewCount: true, likeCount: true,
          publishedAt: true, createdAt: true, updatedAt: true,
        },
      }),
      this.prisma.jobPost.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getJob(companyId: string, jobId: string) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
      include: { profession: { select: { id: true, name: true, slug: true } } },
    });
    if (!job || job.companyId !== companyId) throw new NotFoundException('Stelle nicht gefunden');
    return job;
  }

  async createJob(companyId: string, data: any) {
    const slug = this.generateSlug(data.title) + '-' + Date.now().toString(36);
    return this.prisma.jobPost.create({
      data: {
        companyId, title: data.title, slug,
        description: data.description, requirements: data.requirements, benefits: data.benefits,
        postalCode: data.postalCode, city: data.city,
        salaryYear1: data.salaryYear1, salaryYear2: data.salaryYear2, salaryYear3: data.salaryYear3,
        startDate: data.startDate ? new Date(data.startDate) : null,
        durationMonths: data.durationMonths, positionsAvailable: data.positionsAvailable || 1,
        showOnWebsite: data.showOnWebsite ?? true,
        status: data.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
        ...(data.status === 'ACTIVE' && { publishedAt: new Date() }),
      },
    });
  }

  async updateJob(companyId: string, jobId: string, data: any) {
    const job = await this.prisma.jobPost.findUnique({ where: { id: jobId } });
    if (!job || job.companyId !== companyId) throw new NotFoundException('Stelle nicht gefunden');

    return this.prisma.jobPost.update({
      where: { id: jobId },
      data: {
        ...(data.title !== undefined && { title: data.title, slug: this.generateSlug(data.title) + '-' + Date.now().toString(36) }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.requirements !== undefined && { requirements: data.requirements }),
        ...(data.benefits !== undefined && { benefits: data.benefits }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.salaryYear1 !== undefined && { salaryYear1: data.salaryYear1 }),
        ...(data.salaryYear2 !== undefined && { salaryYear2: data.salaryYear2 }),
        ...(data.salaryYear3 !== undefined && { salaryYear3: data.salaryYear3 }),
        ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.durationMonths !== undefined && { durationMonths: data.durationMonths }),
        ...(data.positionsAvailable !== undefined && { positionsAvailable: data.positionsAvailable }),
        ...(data.showOnWebsite !== undefined && { showOnWebsite: data.showOnWebsite }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  }

  async deleteJob(companyId: string, jobId: string) {
    const job = await this.prisma.jobPost.findUnique({ where: { id: jobId } });
    if (!job || job.companyId !== companyId) throw new NotFoundException('Stelle nicht gefunden');
    return this.prisma.jobPost.update({ where: { id: jobId }, data: { status: 'CLOSED' } });
  }

  // ─── Applications ─────────────────────────────────────────────────────────

  async listApplications(companyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where: { companyId }, skip, take: limit, orderBy: { createdAt: 'desc' },
        select: {
          id: true, firstName: true, lastName: true, email: true, status: true,
          rating: true, jobPostId: true, source: true, createdAt: true,
          jobPost: { select: { id: true, title: true } },
        },
      }),
      this.prisma.application.count({ where: { companyId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getApplication(companyId: string, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { jobPost: { select: { id: true, title: true } }, documents: true },
    });
    if (!app || app.companyId !== companyId) throw new NotFoundException('Bewerbung nicht gefunden');
    return app;
  }

  async updateApplicationStatus(companyId: string, id: string, status: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.companyId !== companyId) throw new NotFoundException('Bewerbung nicht gefunden');
    return this.prisma.application.update({ where: { id }, data: { status: status as any } });
  }

  // ─── Company ──────────────────────────────────────────────────────────────

  async getCompany(companyId: string) {
    return this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, name: true, slug: true, city: true, postalCode: true,
        industry: true, description: true, shortDescription: true,
        logoUrl: true, website: true, employeeCount: true,
      },
    });
  }
}
