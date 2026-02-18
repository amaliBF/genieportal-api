import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  detectCategoryFromTitle,
  normalizeCity,
  parseJoobleSalary,
  createTitleHash,
  generateSlug,
} from '../helpers/normalizer';
import { NormalizedExternalJob } from './adzuna.provider';

@Injectable()
export class JoobleProvider {
  private readonly logger = new Logger(JoobleProvider.name);
  private readonly apiKey: string;
  requestCount = 0;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get('JOOBLE_API_KEY', '');
  }

  async fetchForKeyword(keyword: string, maxPages = 3): Promise<NormalizedExternalJob[]> {
    const allResults: NormalizedExternalJob[] = [];

    for (let page = 1; page <= maxPages; page++) {
      if (this.requestCount >= 490) {
        this.logger.warn('Approaching Jooble daily limit, stopping');
        break;
      }

      try {
        const results = await this.searchPage(keyword, page);
        if (results.length === 0) break;
        allResults.push(...results);

        if (results.length < 10) break; // Jooble returns ~20 per page
      } catch (error) {
        this.logger.error(`Jooble search error (page ${page}): ${(error as Error).message}`);
        break;
      }

      await this.delay(400);
    }

    return allResults;
  }

  private async searchPage(keyword: string, page: number): Promise<NormalizedExternalJob[]> {
    const url = `https://jooble.org/api/${this.apiKey}`;
    this.requestCount++;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: keyword, location: '', page }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 429) {
      this.logger.error('Jooble rate limit hit!');
      this.requestCount = 500;
      return [];
    }

    if (!res.ok) {
      throw new Error(`Jooble API ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return (data.jobs || []).map((r: any) => this.normalize(r));
  }

  private normalize(raw: any): NormalizedExternalJob {
    const salary = parseJoobleSalary(raw.salary);
    const category = detectCategoryFromTitle(raw.title);
    const city = normalizeCity(raw.location);
    const companyName = raw.company || null;

    return {
      sourceId: String(raw.id),
      title: (raw.title || 'Ohne Titel').substring(0, 500),
      slug: generateSlug(raw.title, companyName),
      description: raw.snippet || '',
      companyName,
      city,
      salaryMin: salary.min || undefined,
      salaryMax: salary.max || undefined,
      salaryUnit: salary.unit,
      category: category.label,
      categoryTag: category.slug,
      externalUrl: raw.link,
      publishedAt: raw.updated ? new Date(raw.updated) : undefined,
      titleHash: createTitleHash(raw.title, companyName, city),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
