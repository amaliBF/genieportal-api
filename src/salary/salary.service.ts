import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

  constructor(private prisma: PrismaService) {}

  async getSalaryStats(profession: string, city?: string) {
    const where: any = { professionName: { contains: profession } };
    if (city) where.region = { contains: city };

    const stats = await this.prisma.salaryStatistics.findFirst({ where });

    if (!stats) {
      // Calculate on-the-fly from raw data
      const rawWhere: any = { professionName: { contains: profession } };
      if (city) rawWhere.city = { contains: city };

      const agg = await this.prisma.salaryData.aggregate({
        where: rawWhere,
        _avg: { amount: true },
        _min: { amount: true },
        _max: { amount: true },
        _count: true,
      });

      return {
        profession,
        city: city || null,
        sampleCount: agg._count,
        avgSalary: agg._avg.amount || 0,
        minSalary: agg._min.amount || 0,
        maxSalary: agg._max.amount || 0,
      };
    }

    return stats;
  }

  async submitSalary(userId: string, data: { professionName: string; amount: number; salaryType?: string; city?: string; postalCode?: string }) {
    return this.prisma.salaryData.create({
      data: {
        userId,
        professionName: data.professionName,
        amount: data.amount,
        salaryType: (data.salaryType as any) || 'MONTHLY',
        city: data.city,
        postalCode: data.postalCode,
        source: 'USER_SUBMITTED',
        year: new Date().getFullYear(),
      },
    });
  }

  async getSalaryComparison(profession: string) {
    const stats = await this.prisma.salaryStatistics.findMany({
      where: { professionName: { contains: profession } },
      orderBy: { avgSalary: 'desc' },
      take: 20,
    });

    return stats;
  }
}
