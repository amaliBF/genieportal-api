import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private uploadDir: string;

  constructor(private configService: ConfigService) {
    this.uploadDir =
      this.configService.get('UPLOAD_DIR') ||
      '/var/www/vhosts/ausbildungsgenie.de/uploads';
  }

  async saveFile(
    file: Express.Multer.File,
    subfolder: string,
    entityId: string,
  ): Promise<string> {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const dir = path.join(this.uploadDir, subfolder, entityId);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, file.buffer);

    return `/${subfolder}/${entityId}/${filename}`;
  }

  async deleteFile(relativePath: string): Promise<void> {
    if (!relativePath) return;
    const filepath = path.join(this.uploadDir, relativePath);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }

  validateImage(file: Express.Multer.File): void {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        'Nur JPEG, PNG, WebP und GIF Bilder sind erlaubt',
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Bild darf maximal 5MB groß sein');
    }
  }

  validateVideo(file: Express.Multer.File): void {
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Nur MP4, MOV und WebM Videos sind erlaubt');
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new BadRequestException('Video darf maximal 50MB groß sein');
    }
  }
}
