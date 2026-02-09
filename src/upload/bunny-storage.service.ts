import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

@Injectable()
export class BunnyStorageService {
  private readonly logger = new Logger(BunnyStorageService.name);
  private readonly apiKey: string;
  private readonly storageZone: string;
  private readonly storageEndpoint: string;
  private readonly cdnUrl: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('BUNNY_STORAGE_API_KEY', '');
    this.storageZone = this.config.get<string>('BUNNY_STORAGE_ZONE', 'genie-videos');
    this.storageEndpoint = this.config.get<string>('BUNNY_STORAGE_ENDPOINT', 'https://storage.bunnycdn.com');
    this.cdnUrl = this.config.get<string>('BUNNY_CDN_URL', 'https://cdn.genieportal.de');

    if (this.isConfigured) {
      this.logger.log('BunnyCDN Storage konfiguriert');
    } else {
      this.logger.warn('BunnyCDN Storage NICHT konfiguriert – Videos bleiben lokal');
    }
  }

  get isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async uploadFile(localPath: string, remotePath: string): Promise<string> {
    const url = `${this.storageEndpoint}/${this.storageZone}/${remotePath}`;
    const fileBuffer = fs.readFileSync(localPath);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        AccessKey: this.apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`BunnyCDN upload failed (${response.status}): ${text}`);
    }

    return `${this.cdnUrl}/${remotePath}`;
  }

  async deleteFile(remotePath: string): Promise<boolean> {
    if (!remotePath) return false;

    const url = `${this.storageEndpoint}/${this.storageZone}/${remotePath}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          AccessKey: this.apiKey,
        },
      });

      if (!response.ok) {
        this.logger.warn(`BunnyCDN delete failed (${response.status}) for ${remotePath}`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.error(`BunnyCDN delete error for ${remotePath}: ${err.message}`);
      return false;
    }
  }
}
