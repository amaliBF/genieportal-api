import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  detectCategoryFromTitle,
  normalizeCity,
  createTitleHash,
  generateSlug,
} from '../helpers/normalizer';
import { NormalizedExternalJob } from './adzuna.provider';

@Injectable()
export class CareerjetProvider {
  private readonly logger = new Logger(CareerjetProvider.name);
  requestCount = 0;

  private readonly keys: Record<string, string>;

  constructor(private config: ConfigService) {
    this.keys = {
      werkstudent: this.config.get('CAREERJET_AFFID_WERKSTUDENT', ''),
      ausbildung: this.config.get('CAREERJET_AFFID_AUSBILDUNG', ''),
      praktikum: this.config.get('CAREERJET_AFFID_PRAKTIKUM', ''),
      minijob: this.config.get('CAREERJET_AFFID_MINIJOB', ''),
      vollzeit: this.config.get('CAREERJET_AFFID_VOLLZEIT', ''),
    };
  }

  async fetchForKeyword(
    keyword: string,
    jobType: string,
    maxPages = 2,
  ): Promise<NormalizedExternalJob[]> {
    const apiKey = this.keys[jobType];
    if (!apiKey) {
      this.logger.warn(`No Careerjet key for jobType: ${jobType}`);
      return [];
    }

    const allResults: NormalizedExternalJob[] = [];

    for (let page = 1; page <= maxPages; page++) {
      try {
        const results = await this.searchPage(apiKey, keyword, page);
        if (results.length === 0) break;
        allResults.push(...results);

        if (results.length < 100) break; // Max page_size = 100
      } catch (error) {
        this.logger.error(`Careerjet search error (page ${page}): ${(error as Error).message}`);
        break;
      }

      await this.delay(500);
    }

    return allResults;
  }

  private async searchPage(
    apiKey: string,
    keyword: string,
    page: number,
  ): Promise<NormalizedExternalJob[]> {
    const url = new URL('https://public.api.careerjet.net/search');
    url.searchParams.set('locale_code', 'de_DE');
    url.searchParams.set('keywords', keyword);
    url.searchParams.set('sort', 'date');
    url.searchParams.set('page', String(page));
    url.searchParams.set('pagesize', '99');
    url.searchParams.set('affid', apiKey);

    this.requestCount++;

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Careerjet API ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.type !== 'JOBS') return [];

    return (data.jobs || []).map((r: any) => this.normalize(r));
  }

  private normalize(raw: any): NormalizedExternalJob {
    const category = detectCategoryFromTitle(raw.title);
    const city = normalizeCity(raw.locations);
    const companyName = raw.company || null;

    // Careerjet provides structured salary data
    const salaryTypeMap: Record<string, string> = {
      Y: 'YEAR',
      M: 'MONTH',
      W: 'MONTH',
      D: 'MONTH',
      H: 'HOUR',
    };

    let salaryMin: number | undefined;
    let salaryMax: number | undefined;
    let salaryUnit = 'MONTH';

    if (raw.salary_min) {
      salaryMin = Math.round(raw.salary_min);
      salaryMax = raw.salary_max ? Math.round(raw.salary_max) : undefined;
      salaryUnit = salaryTypeMap[raw.salary_type] || 'MONTH';

      // Convert yearly to monthly
      if (salaryUnit === 'YEAR' && salaryMin > 5000) {
        salaryMin = Math.round(salaryMin / 12);
        salaryMax = salaryMax ? Math.round(salaryMax / 12) : undefined;
        salaryUnit = 'MONTH';
      }
    }

    // Careerjet has no native ID - generate from URL
    const sourceId = raw.url
      ? createHash('md5').update(raw.url).digest('hex').substring(0, 16)
      : `cj-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    return {
      sourceId,
      title: (raw.title || 'Ohne Titel').substring(0, 500),
      slug: generateSlug(raw.title, companyName),
      description: raw.description || '',
      companyName,
      city,
      salaryMin,
      salaryMax,
      salaryUnit,
      category: category.label,
      categoryTag: category.slug,
      externalUrl: raw.url,
      publishedAt: raw.date ? new Date(raw.date) : undefined,
      titleHash: createTitleHash(raw.title, companyName, city),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
