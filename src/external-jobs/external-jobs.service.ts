import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AdzunaProvider } from './providers/adzuna.provider';
import { JoobleProvider } from './providers/jooble.provider';
import { CareerjetProvider } from './providers/careerjet.provider';
import { NormalizedExternalJob } from './providers/adzuna.provider';
import { PORTAL_SEARCH_CONFIG } from './helpers/normalizer';

@Injectable()
export class ExternalJobsService {
  private readonly logger = new Logger(ExternalJobsService.name);

  constructor(
    private prisma: PrismaService,
    private adzuna: AdzunaProvider,
    private jooble: JoobleProvider,
    private careerjet: CareerjetProvider,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // CRON: Daily import at 04:00
  // ═══════════════════════════════════════════════════════════════

  @Cron('0 4 * * *')
  async runDailyImport() {
    this.logger.log('=== Starting daily external job import ===');
    const startTime = Date.now();

    // Reset request counters
    this.adzuna.requestCount = 0;
    this.jooble.requestCount = 0;
    this.careerjet.requestCount = 0;

    const totals = { fetched: 0, new: 0, updated: 0, skipped: 0, errors: 0 };

    for (const portalConfig of PORTAL_SEARCH_CONFIG) {
      try {
        const result = await this.importForPortal(portalConfig);
        totals.fetched += result.fetched;
        totals.new += result.new;
        totals.updated += result.updated;
        totals.skipped += result.skipped;
        totals.errors += result.errors;
      } catch (error) {
        this.logger.error(
          `Import failed for ${portalConfig.jobType}: ${(error as Error).message}`,
        );
      }
    }

    // Deactivate stale jobs
    const deactivated = await this.deactivateStaleJobs();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    this.logger.log(
      `=== Import complete: ${totals.fetched} fetched, ${totals.new} new, ` +
        `${totals.updated} updated, ${totals.skipped} skipped, ${totals.errors} errors, ` +
        `${deactivated} deactivated in ${duration}s ===`,
    );
    this.logger.log(
      `API usage: Adzuna ${this.adzuna.requestCount}/250, ` +
        `Jooble ${this.jooble.requestCount}/500, ` +
        `Careerjet ${this.careerjet.requestCount}`,
    );
  }

  async importForPortal(portalConfig: (typeof PORTAL_SEARCH_CONFIG)[number]) {
    const { jobType, portalId, searches } = portalConfig;
    this.logger.log(`\n--- Importing for ${jobType} (portal ${portalId}) ---`);

    const importStart = Date.now();
    const allJobs: NormalizedExternalJob[] = [];
    const seenHashes = new Set<string>();

    // Collect jobs from all 3 sources for all search keywords
    for (const search of searches) {
      // Adzuna
      try {
        const adzunaJobs = await this.adzuna.fetchForJobType(search.keyword);
        for (const job of adzunaJobs) {
          if (!seenHashes.has(job.titleHash)) {
            seenHashes.add(job.titleHash);
            allJobs.push(job);
          }
        }
        this.logger.log(`  Adzuna "${search.keyword}": ${adzunaJobs.length} jobs`);
      } catch (e) {
        this.logger.error(`  Adzuna "${search.keyword}" failed: ${(e as Error).message}`);
      }

      // Jooble
      try {
        const joobleJobs = await this.jooble.fetchForKeyword(search.keyword);
        let joobleNew = 0;
        for (const job of joobleJobs) {
          if (!seenHashes.has(job.titleHash)) {
            seenHashes.add(job.titleHash);
            allJobs.push(job);
            joobleNew++;
          }
        }
        this.logger.log(
          `  Jooble "${search.keyword}": ${joobleJobs.length} jobs (${joobleNew} unique)`,
        );
      } catch (e) {
        this.logger.error(`  Jooble "${search.keyword}" failed: ${(e as Error).message}`);
      }

      // Careerjet
      try {
        const careerjetJobs = await this.careerjet.fetchForKeyword(search.keyword, jobType);
        let cjNew = 0;
        for (const job of careerjetJobs) {
          if (!seenHashes.has(job.titleHash)) {
            seenHashes.add(job.titleHash);
            allJobs.push(job);
            cjNew++;
          }
        }
        this.logger.log(
          `  Careerjet "${search.keyword}": ${careerjetJobs.length} jobs (${cjNew} unique)`,
        );
      } catch (e) {
        this.logger.error(`  Careerjet "${search.keyword}" failed: ${(e as Error).message}`);
      }
    }

    // Also fetch Adzuna by category for berufsgenie (vollzeit)
    if (portalConfig.adzunaCategories) {
      for (const cat of portalConfig.adzunaCategories) {
        try {
          const catJobs = await this.adzuna.fetchForJobType('', { category: cat, maxPages: 2 });
          let catNew = 0;
          for (const job of catJobs) {
            if (!seenHashes.has(job.titleHash)) {
              seenHashes.add(job.titleHash);
              allJobs.push(job);
              catNew++;
            }
          }
          this.logger.log(`  Adzuna category "${cat}": ${catJobs.length} jobs (${catNew} unique)`);
        } catch (e) {
          this.logger.error(`  Adzuna category "${cat}" failed: ${(e as Error).message}`);
        }
      }
    }

    this.logger.log(`  Total unique jobs for ${jobType}: ${allJobs.length}`);

    // Upsert to database
    const result = await this.upsertJobs(allJobs, jobType, portalId);

    // Log import
    await this.prisma.externalJobImportLog.create({
      data: {
        source: 'ADZUNA', // Combined import
        portalId,
        jobType,
        status: 'COMPLETED',
        totalFetched: allJobs.length,
        newCount: result.new,
        updatedCount: result.updated,
        skippedCount: result.skipped,
        errorCount: result.errors,
        durationMs: Date.now() - importStart,
        completedAt: new Date(),
      },
    });

    return { fetched: allJobs.length, ...result };
  }

  // ═══════════════════════════════════════════════════════════════
  // UPSERT: Jobs in DB schreiben
  // ═══════════════════════════════════════════════════════════════

  private async upsertJobs(
    jobs: NormalizedExternalJob[],
    jobType: string,
    portalId: number,
  ): Promise<{ new: number; updated: number; skipped: number; errors: number }> {
    let newCount = 0,
      updatedCount = 0,
      skippedCount = 0,
      errorCount = 0;

    for (const job of jobs) {
      try {
        if (!job.externalUrl || !job.title) {
          skippedCount++;
          continue;
        }

        // Determine source from provider (check which adapter produced this)
        const source = this.detectSource(job);

        const existing = await this.prisma.externalJob.findUnique({
          where: { source_sourceId: { source, sourceId: job.sourceId } },
        });

        if (existing) {
          await this.prisma.externalJob.update({
            where: { id: existing.id },
            data: {
              lastSeenAt: new Date(),
              isActive: true,
              title: job.title,
              description: job.description,
              salaryMin: job.salaryMin,
              salaryMax: job.salaryMax,
              externalUrl: job.externalUrl,
            },
          });
          updatedCount++;
        } else {
          // Cross-source dedup by titleHash
          const dupe = await this.prisma.externalJob.findFirst({
            where: { titleHash: job.titleHash, portalId, isActive: true },
          });

          if (dupe) {
            skippedCount++;
            continue;
          }

          await this.prisma.externalJob.create({
            data: {
              source,
              sourceId: job.sourceId,
              title: job.title,
              slug: job.slug,
              description: job.description,
              companyName: job.companyName,
              city: job.city,
              postalCode: job.postalCode,
              latitude: job.latitude,
              longitude: job.longitude,
              salaryMin: job.salaryMin,
              salaryMax: job.salaryMax,
              salaryUnit: job.salaryUnit,
              category: job.category,
              categoryTag: job.categoryTag,
              jobType,
              portalId,
              externalUrl: job.externalUrl,
              publishedAt: job.publishedAt,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              lastSeenAt: new Date(),
              isActive: true,
              titleHash: job.titleHash,
            },
          });
          newCount++;
        }
      } catch (error) {
        errorCount++;
        if (errorCount <= 5) {
          this.logger.error(`Upsert error: ${(error as Error).message}`);
        }
      }
    }

    return { new: newCount, updated: updatedCount, skipped: skippedCount, errors: errorCount };
  }

  private detectSource(job: NormalizedExternalJob): 'ADZUNA' | 'JOOBLE' | 'CAREERJET' {
    if (job.externalUrl?.includes('adzuna')) return 'ADZUNA';
    if (job.externalUrl?.includes('jooble')) return 'JOOBLE';
    if (job.externalUrl?.includes('jobviewtrack') || job.externalUrl?.includes('careerjet'))
      return 'CAREERJET';
    // Default based on sourceId format
    if (/^\d+$/.test(job.sourceId) && job.sourceId.length > 8) return 'JOOBLE';
    if (job.sourceId.length === 16 && /^[a-f0-9]+$/.test(job.sourceId)) return 'CAREERJET';
    return 'ADZUNA';
  }

  // ═══════════════════════════════════════════════════════════════
  // DEACTIVATION: Stale jobs
  // ═══════════════════════════════════════════════════════════════

  private async deactivateStaleJobs(): Promise<number> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.externalJob.updateMany({
      where: {
        lastSeenAt: { lt: threeDaysAgo },
        isActive: true,
      },
      data: { isActive: false },
    });

    if (result.count > 0) {
      this.logger.log(`Deactivated ${result.count} stale external jobs`);
    }

    return result.count;
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN: Stats & Manual Trigger
  // ═══════════════════════════════════════════════════════════════

  async getStats() {
    const [totalActive, bySource, byJobType, recentImports] = await Promise.all([
      this.prisma.externalJob.count({ where: { isActive: true } }),
      this.prisma.externalJob.groupBy({
        by: ['source'],
        where: { isActive: true },
        _count: true,
      }),
      this.prisma.externalJob.groupBy({
        by: ['jobType'],
        where: { isActive: true },
        _count: true,
      }),
      this.prisma.externalJobImportLog.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      totalActive,
      bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
      byJobType: byJobType.map((j) => ({ jobType: j.jobType, count: j._count })),
      recentImports,
    };
  }

  async triggerImport() {
    // Run import in background (don't await in HTTP handler)
    this.runDailyImport().catch((e) =>
      this.logger.error(`Manual import failed: ${e.message}`),
    );
    return { message: 'Import started in background' };
  }
}
