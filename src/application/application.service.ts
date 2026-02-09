import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { UploadService } from '../upload/upload.service';
import { BunnyStorageService } from '../upload/bunny-storage.service';
import { WebhookService } from './webhook.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private uploadService: UploadService,
    private bunnyStorage: BunnyStorageService,
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

    // Upload documents (BunnyCDN with local fallback)
    if (files?.length) {
      for (const file of files.slice(0, 5)) {
        if (file.size > 5 * 1024 * 1024) continue;

        // Always save locally first
        const localPath = await this.uploadService.saveFile(
          file, 'applications', `${job.companyId}/${application.id}`,
        );

        let storagePath = localPath;

        // Upload to BunnyCDN if configured
        if (this.bunnyStorage.isConfigured) {
          try {
            const ext = path.extname(file.originalname).toLowerCase();
            const remotePath = `applications/${job.companyId}/${application.id}/${path.basename(localPath)}`;
            const uploadDir = process.env.UPLOAD_DIR || '/var/www/vhosts/ausbildungsgenie.de/uploads';
            const fullLocalPath = path.join(uploadDir, localPath);
            storagePath = await this.bunnyStorage.uploadFile(fullLocalPath, remotePath);
          } catch (err) {
            this.logger.warn(`BunnyCDN upload failed for doc, using local: ${(err as Error).message}`);
          }
        }

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

  async exportApplications(companyId: string, filters?: {
    status?: string; jobPostId?: string; dateFrom?: string; dateTo?: string;
  }) {
    const where: any = { companyId };
    if (filters?.status) where.status = filters.status;
    if (filters?.jobPostId) where.jobPostId = filters.jobPostId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59');
    }

    const apps = await this.prisma.application.findMany({
      where,
      include: { jobPost: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const escape = (v: string) => v.includes(';') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    const headers = ['Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Stelle', 'Status', 'Bewertung', 'Datum', 'Quelle'];
    const rows = apps.map(a => [
      escape(a.firstName), escape(a.lastName), escape(a.email), escape(a.phone || ''),
      escape(a.jobPost?.title || ''), a.status, a.rating?.toString() || '',
      new Date(a.createdAt).toISOString().split('T')[0], a.source || '',
    ].join(';'));

    return '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
  }

  // ─── USER: Get my applications ──────────────────────────────────────────────

  async getUserApplications(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) return [];

    const applications = await this.prisma.application.findMany({
      where: {
        OR: [
          { userId: userId },
          { email: user.email },
        ],
      },
      include: {
        jobPost: {
          select: {
            id: true,
            title: true,
            company: { select: { id: true, name: true, logoUrl: true } },
          },
        },
        documents: {
          select: { id: true, dokumentTyp: true, originalName: true, fileSize: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return applications;
  }

  // ─── USER: Get single application ──────────────────────────────────────────

  async getUserApplication(userId: string, applicationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden');

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        jobPost: {
          select: {
            id: true,
            title: true,
            company: { select: { id: true, name: true, logoUrl: true } },
          },
        },
        documents: true,
      },
    });

    if (!application) throw new NotFoundException('Bewerbung nicht gefunden');
    if (application.userId !== userId && application.email !== user.email) {
      throw new NotFoundException('Bewerbung nicht gefunden');
    }

    return application;
  }

  // ─── USER: Submit application from app ─────────────────────────────────────

  async submitFromApp(
    userId: string,
    jobPostId: string,
    data: any,
    files: Express.Multer.File[],
  ) {
    // Fetch user data to pre-fill
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden');

    // Merge user data with submission data
    const mergedData = {
      firstName: data.firstName || user.firstName,
      lastName: data.lastName || user.lastName || '',
      email: data.email || user.email,
      phone: data.phone || user.phone || null,
      postalCode: data.postalCode || user.postalCode || null,
      city: data.city || user.city || null,
      message: data.message || null,
      anschreiben: data.anschreiben || null,
      schulabschluss: data.schulabschluss || user.currentSchoolType || null,
      abschlussjahr: data.abschlussjahr || (user.graduationYear ? String(user.graduationYear) : null),
      datenschutzAkzeptiert: true,
    };

    // Use existing submitApplication method with APP source
    const result = await this.submitApplication(jobPostId, mergedData, files, 'APP');

    // Link application to user
    if (result.applicationId) {
      await this.prisma.application.update({
        where: { id: result.applicationId },
        data: { userId },
      });
    }

    return result;
  }

  // ─── USER: Withdraw application ────────────────────────────────────────────

  async withdrawApplication(userId: string, applicationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden');

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) throw new NotFoundException('Bewerbung nicht gefunden');
    if (application.userId !== userId && application.email !== user.email) {
      throw new NotFoundException('Bewerbung nicht gefunden');
    }

    if (application.status === 'WITHDRAWN') {
      return { success: true, message: 'Bewerbung war bereits zurueckgezogen' };
    }

    await this.prisma.application.update({
      where: { id: applicationId },
      data: { status: 'WITHDRAWN' },
    });

    return { success: true, message: 'Bewerbung zurueckgezogen' };
  }

  // ─── DASHBOARD: Delete application (DSGVO) ─────────────────────────────────

  async deleteApplication(companyId: string, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!app || app.companyId !== companyId) throw new NotFoundException('Bewerbung nicht gefunden');

    // Delete documents from storage
    for (const doc of app.documents) {
      try {
        if (doc.storagePath.startsWith('http')) {
          // BunnyCDN URL - extract remote path
          const cdnUrl = process.env.BUNNY_CDN_URL || 'https://cdn.genieportal.de';
          const remotePath = doc.storagePath.replace(cdnUrl + '/', '');
          await this.bunnyStorage.deleteFile(remotePath);
        } else {
          // Local file
          await this.uploadService.deleteFile(doc.storagePath);
        }
      } catch (err) {
        this.logger.warn(`Failed to delete doc file ${doc.storagePath}: ${(err as Error).message}`);
      }
    }

    // Delete documents from DB, then application
    await this.prisma.applicationDocument.deleteMany({ where: { applicationId: id } });
    await this.prisma.application.delete({ where: { id } });

    return { success: true, message: 'Bewerbung und Dokumente geloescht (DSGVO)' };
  }
}
