import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(private prisma: PrismaService) {}

  // ─── SLOTS (Firma erstellt Zeitfenster) ──────────────────────────────────────

  async createSlots(companyId: string, data: { jobPostId?: string; date: string; slots: { startTime: string; endTime: string; durationMin?: number }[] }) {
    const created = await this.prisma.interviewSlot.createMany({
      data: data.slots.map((s) => ({
        companyId,
        jobPostId: data.jobPostId,
        date: new Date(data.date),
        startTime: s.startTime,
        endTime: s.endTime,
        durationMin: s.durationMin || 30,
      })),
    });
    return { created: created.count };
  }

  async getSlots(companyId: string, jobPostId?: string, date?: string) {
    const where: any = { companyId, isActive: true };
    if (jobPostId) where.jobPostId = jobPostId;
    if (date) where.date = new Date(date);

    return this.prisma.interviewSlot.findMany({
      where,
      include: { interview: { select: { id: true, status: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async deleteSlot(companyId: string, slotId: string) {
    const slot = await this.prisma.interviewSlot.findFirst({
      where: { id: slotId, companyId, isBooked: false },
    });
    if (!slot) throw new NotFoundException('Zeitfenster nicht gefunden oder bereits gebucht.');

    await this.prisma.interviewSlot.delete({ where: { id: slotId } });
    return { message: 'Zeitfenster gelöscht.' };
  }

  // ─── INTERVIEWS (Firma bucht Slot für Bewerber) ──────────────────────────────

  async bookInterview(companyId: string, data: { slotId: string; applicationId: string; type?: string; location?: string; meetingUrl?: string; notes?: string }) {
    const slot = await this.prisma.interviewSlot.findFirst({
      where: { id: data.slotId, companyId, isBooked: false, isActive: true },
    });
    if (!slot) throw new BadRequestException('Zeitfenster nicht verfügbar.');

    const application = await this.prisma.application.findFirst({
      where: { id: data.applicationId, companyId },
    });
    if (!application) throw new NotFoundException('Bewerbung nicht gefunden.');

    const interview = await this.prisma.$transaction(async (tx) => {
      await tx.interviewSlot.update({
        where: { id: data.slotId },
        data: { isBooked: true },
      });

      return tx.interview.create({
        data: {
          slotId: data.slotId,
          applicationId: data.applicationId,
          companyId,
          jobPostId: slot.jobPostId,
          type: (data.type as any) || 'IN_PERSON',
          location: data.location,
          meetingUrl: data.meetingUrl,
          notes: data.notes,
        },
      });
    });

    return interview;
  }

  async getInterviews(companyId: string, status?: string) {
    const where: any = { companyId };
    if (status) where.status = status;

    return this.prisma.interview.findMany({
      where,
      include: {
        slot: true,
        application: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
        jobPost: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInterviewStatus(companyId: string, interviewId: string, status: string, feedback?: string, rating?: number) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, companyId },
    });
    if (!interview) throw new NotFoundException('Interview nicht gefunden.');

    return this.prisma.interview.update({
      where: { id: interviewId },
      data: { status: status as any, feedback, rating },
    });
  }

  async cancelInterview(companyId: string, interviewId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, companyId },
    });
    if (!interview) throw new NotFoundException('Interview nicht gefunden.');

    await this.prisma.$transaction([
      this.prisma.interview.update({
        where: { id: interviewId },
        data: { status: 'INTERVIEW_CANCELLED' },
      }),
      this.prisma.interviewSlot.update({
        where: { id: interview.slotId },
        data: { isBooked: false },
      }),
    ]);

    return { message: 'Interview abgesagt.' };
  }
}
