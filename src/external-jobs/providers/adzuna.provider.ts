import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CATEGORY_MAP,
  normalizeCity,
  createTitleHash,
  generateSlug,
} from '../helpers/normalizer';

export interface NormalizedExternalJob {
  sourceId: string;
  title: string;
  slug: string;
  description?: string;
  companyName?: string;
  city?: string | null;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  salaryMin?: number;
  salaryMax?: number;
  salaryUnit?: string;
  category?: string;
  categoryTag?: string;
  externalUrl: string;
  publishedAt?: Date;
  titleHash: string;
}

@Injectable()
export class AdzunaProvider {
  private readonly logger = new Logger(AdzunaProvider.name);
  private readonly appId: string;
  private readonly appKey: string;
  requestCount = 0;

  constructor(private config: ConfigService) {
    this.appId = this.config.get('ADZUNA_APP_ID', '');
    this.appKey = this.config.get('ADZUNA_API_KEY', '');
  }

  async fetchForJobType(
    keyword: string,
    options?: { category?: string; maxPages?: number },
  ): Promise<NormalizedExternalJob[]> {
    const maxPages = options?.maxPages || 2;
    const allResults: NormalizedExternalJob[] = [];

    for (let page = 1; page <= maxPages; page++) {
      if (this.requestCount >= 240) {
        this.logger.warn('Approaching Adzuna daily limit, stopping');
        break;
      }

      try {
        const results = await this.searchPage(keyword, page, options?.category);
        if (results.length === 0) break;
        allResults.push(...results);

        if (results.length < 50) break; // Less than full page = no more results
      } catch (error) {
        this.logger.error(`Adzuna search error (page ${page}): ${(error as Error).message}`);
        break;
      }

      // Rate limit delay
      await this.delay(500);
    }

    return allResults;
  }

  private async searchPage(
    keyword: string,
    page: number,
    category?: string,
  ): Promise<NormalizedExternalJob[]> {
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/de/search/${page}`);
    url.searchParams.set('app_id', this.appId);
    url.searchParams.set('app_key', this.appKey);
    url.searchParams.set('results_per_page', '50');
    url.searchParams.set('max_days_old', '30');
    url.searchParams.set('sort_by', 'date');

    if (category) {
      url.searchParams.set('category', category);
    } else {
      url.searchParams.set('what', keyword);
    }

    this.requestCount++;
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });

    if (res.status === 429) {
      this.logger.error('Adzuna rate limit hit!');
      this.requestCount = 250;
      return [];
    }

    if (!res.ok) {
      throw new Error(`Adzuna API ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return (data.results || []).map((r: any) => this.normalize(r));
  }

  private normalize(raw: any): NormalizedExternalJob {
    const categoryTag = raw.category?.tag || 'other-general-jobs';
    const mapped = CATEGORY_MAP[categoryTag] || { slug: 'sonstige', label: 'Sonstige' };
    const city = normalizeCity(raw.location?.display_name);
    const companyName = raw.company?.display_name || null;

    // Adzuna salary is yearly - convert to monthly
    let salaryMin: number | undefined;
    let salaryMax: number | undefined;
    let salaryUnit = 'MONTH';

    if (raw.salary_min) {
      if (raw.salary_min < 100) {
        // Likely hourly
        salaryMin = Math.round(raw.salary_min);
        salaryMax = raw.salary_max ? Math.round(raw.salary_max) : undefined;
        salaryUnit = 'HOUR';
      } else if (raw.salary_min > 5000) {
        // Yearly → convert to monthly
        salaryMin = Math.round(raw.salary_min / 12);
        salaryMax = raw.salary_max ? Math.round(raw.salary_max / 12) : undefined;
      } else {
        salaryMin = Math.round(raw.salary_min);
        salaryMax = raw.salary_max ? Math.round(raw.salary_max) : undefined;
      }
    }

    return {
      sourceId: String(raw.id),
      title: (raw.title || 'Ohne Titel').substring(0, 500),
      slug: generateSlug(raw.title, companyName),
      description: raw.description || '',
      companyName,
      city,
      latitude: raw.latitude || undefined,
      longitude: raw.longitude || undefined,
      salaryMin,
      salaryMax,
      salaryUnit,
      category: mapped.label,
      categoryTag: mapped.slug,
      externalUrl: raw.redirect_url,
      publishedAt: raw.created ? new Date(raw.created) : undefined,
      titleHash: createTitleHash(raw.title, companyName, city),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
