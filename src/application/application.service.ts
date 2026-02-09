import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { UploadService } from '../upload/upload.service';
import { WebhookService } from './webhook.service';

@Injectable()
export class ApplicationService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private uploadService: UploadService,
    private webhookService: WebhookService,
  ) {}

  // ─── PUBLIC: Get form config for a job ────────────────────────────────────

  async getFormConfig(jobPostId: string) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobPostId },
      select: { id: true, title: true, companyId: true, company: { select: { name: true } } },
    });
    if (!job) throw new NotFoundException('Stelle nicht gefunden');

    const config = await this.prisma.applicationFormConfig.findUnique({
      where: { companyId: job.companyId },
    });

    return {
      jobId: job.id,
      jobTitle: job.title,
      companyName: job.company.name,
      config: config || {
        activeFields: ['firstName', 'lastName', 'email', 'message'],
        requiredFields: ['firstName', 'lastName', 'email'],
        customFields: [],
        allowWebsiteApplication: true,
      },
    };
  }

  // ─── PUBLIC: Submit application ───────────────────────────────────────────

  async submitApplication(
    jobPostId: string,
    data: any,
    files: Express.Multer.File[],
    source: string = 'WEBSITE',
  ) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobPostId },
      select: {
        id: true, title: true, companyId: true, portalId: true,
        company: { select: { name: true, email: true } },
      },
    });
    if (!job) throw new NotFoundException('Stelle nicht gefunden');

    if (!data.datenschutzAkzeptiert) {
      throw new BadRequestException('Datenschutzerklaerung muss akzeptiert werden');
    }

    const application = await this.prisma.application.create({
      data: {
        jobPostId: job.id,
        companyId: job.companyId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        postalCode: data.postalCode || null,
        city: data.city || null,
        message: data.message || null,
        anschreiben: data.anschreiben || null,
        schulabschluss: data.schulabschluss || null,
        abschlussjahr: data.abschlussjahr ? parseInt(data.abschlussjahr, 10) : null,
        sourceChannel: data.sourceChannel || null,
        newsletterOptIn: data.newsletterOptIn === 'true' || data.newsletterOptIn === true,
        datenschutzAkzeptiert: true,
        source: source as any,
        portalId: job.portalId,
        status: 'NEW',
      },
    });

    // Upload documents
    if (files?.length) {
      for (const file of files.slice(0, 5)) {
        if (file.size > 5 * 1024 * 1024) continue;
        const storagePath = await this.uploadService.saveFile(
          file, 'applications', `${job.companyId}/${application.id}`,
        );
        await this.prisma.applicationDocument.create({
          data: {
            applicationId: application.id,
            dokumentTyp: 'SONSTIGES',
            filename: file.filename || file.originalname,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            storagePath,
          },
        });
      }
    }

    // Send emails (fire-and-forget)
    this.emailService.sendApplicationConfirmation(
      data.email, data.firstName, job.title, job.company.name,
    ).catch(() => {});

    this.emailService.sendNewApplicationNotification(
      job.company.email, job.company.name, `${data.firstName} ${data.lastName}`,
      job.title, `https://dashboard.genieportal.de/bewerbungen`,
    ).catch(() => {});

    // Webhook
    this.webhookService.dispatch(job.companyId, 'application.created', {
      applicationId: application.id,
      jobPostId: job.id,
      applicantName: `${data.firstName} ${data.lastName}`,
      applicantEmail: data.email,
    }).catch(() => {});

    return { success: true, applicationId: application.id };
  }

  // ─── DASHBOARD: List applications ─────────────────────────────────────────

  async listApplications(companyId: string, filters: {
    status?: string; jobPostId?: string; search?: string;
    page?: number; limit?: number;
  }) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 && filters.limit <= 100 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (filters.status) where.status = filters.status;
    if (filters.jobPostId) where.jobPostId = filters.jobPostId;
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search } },
        { lastName: { contains: filters.search } },
        { email: { contains: filters.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          jobPost: { select: { id: true, title: true } },
          documents: { select: { id: true, dokumentTyp: true, originalName: true, fileSize: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.application.count({ where }),
    ]);

    const statusCounts = await this.prisma.application.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true,
    });

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) }, statusCounts };
  }

  // ─── DASHBOARD: Get single application ────────────────────────────────────

  async getApplication(companyId: string, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        jobPost: { select: { id: true, title: true } },
        documents: true,
      },
    });
    if (!app || app.companyId !== companyId) throw new NotFoundException('Bewerbung nicht gefunden');

    // Auto-mark as viewed
    if (app.status === 'NEW') {
      await this.prisma.application.update({
        where: { id },
        data: { status: 'VIEWED' },
      });
    }

    return app;
  }

  // ─── DASHBOARD: Update status ─────────────────────────────────────────────

  async updateStatus(companyId: string, id: string, status: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.companyId !== companyId) throw new NotFoundException('Bewerbung nicht gefunden');

    return this.prisma.application.update({
      where: { id },
      data: { status: status as any },
    });
  }

  // ─── DASHBOARD: Update notes ──────────────────────────────────────────────

  async updateNotes(companyId: string, id: string, notes: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.companyId !== companyId) throw new NotFoundException('Bewerbung nicht gefunden');

    return this.prisma.application.update({
      where: { id },
      data: { interneNotizen: notes },
    });
  }

  // ─── DASHBOARD: Update rating ─────────────────────────────────────────────

  async updateRating(companyId: string, id: string, rating: number) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.companyId !== companyId) throw new NotFoundException('Bewerbung nicht gefunden');

    return this.prisma.application.update({
      where: { id },
      data: { rating },
    });
  }

  // ─── DASHBOARD: Form config ───────────────────────────────────────────────

  async getFormConfigForCompany(companyId: string) {
    const config = await this.prisma.applicationFormConfig.findUnique({
      where: { companyId },
    });
    return config || {
      activeFields: ['firstName', 'lastName', 'email', 'message'],
      requiredFields: ['firstName', 'lastName', 'email'],
      customFields: [],
      allowAppApplication: true,
      allowWebsiteApplication: true,
    };
  }

  async updateFormConfig(companyId: string, data: any) {
    return this.prisma.applicationFormConfig.upsert({
      where: { companyId },
      update: { ...data },
      create: { companyId, ...data },
    });
  }

  // ─── DASHBOARD: Export applications ───────────────────────────────────────

  async exportApplications(companyId: string) {
    const apps = await this.prisma.application.findMany({
      where: { companyId },
      include: { jobPost: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Stelle', 'Status', 'Bewertung', 'Datum'];
    const rows = apps.map(a => [
      a.firstName, a.lastName, a.email, a.phone || '',
      a.jobPost?.title || '', a.status, a.rating?.toString() || '',
      new Date(a.createdAt).toISOString().split('T')[0],
    ].join(';'));

    return '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
  }
}
