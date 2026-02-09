import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { BunnyStorageService } from '../upload/bunny-storage.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  private readonly uploadDir: string;

  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    private bunnyStorage: BunnyStorageService,
    private config: ConfigService,
  ) {
    this.uploadDir = this.config.get<string>(
      'UPLOAD_DIR',
      '/var/www/vhosts/ausbildungsgenie.de/uploads',
    );
  }

  // ─── PUBLIC FEED ────────────────────────────────────────────────────────────

  async findFeed(page: number, limit: number, portalId?: number) {
    const skip = (page - 1) * limit;

    const where: any = { status: 'ACTIVE' };
    if (portalId) {
      where.company = { portalId };
    }

    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              city: true,
            },
          },
          profession: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.video.count({ where }),
    ]);

    return {
      data: videos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── FIND SINGLE VIDEO ─────────────────────────────────────────────────────

  async findOne(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            city: true,
          },
        },
        profession: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    if (!video) {
      throw new NotFoundException('Video nicht gefunden');
    }

    // Increment view count
    await this.prisma.video.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return {
      ...video,
      viewCount: video.viewCount + 1,
    };
  }

  // ─── TRACK VIEW ─────────────────────────────────────────────────────────────

  async trackView(videoId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true },
    });

    if (!video) {
      throw new NotFoundException('Video nicht gefunden');
    }

    await this.prisma.video.update({
      where: { id: videoId },
      data: { viewCount: { increment: 1 } },
    });

    return { success: true };
  }

  // ─── FIND BY COMPANY (DASHBOARD) ───────────────────────────────────────────

  async findByCompany(companyId: string) {
    return this.prisma.video.findMany({
      where: { companyId },
      include: {
        profession: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── CREATE VIDEO ──────────────────────────────────────────────────────────

  async create(
    companyId: string,
    file: Express.Multer.File,
    dto: CreateVideoDto,
  ) {
    // Validate video file
    this.uploadService.validateVideo(file);

    // Save file to disk
    const filepath = await this.uploadService.saveFile(
      file,
      'videos',
      companyId,
    );

    // Create DB record with PROCESSING status
    const video = await this.prisma.video.create({
      data: {
        companyId,
        title: dto.title || null,
        description: dto.description || null,
        jobPostId: dto.jobPostId || null,
        professionId: dto.professionId || null,
        videoType: dto.videoType || null,
        featuredPerson: dto.featuredPerson || null,
        filename: file.originalname,
        filepath,
        filesize: file.size,
        mimeType: file.mimetype,
        status: 'PROCESSING',
      },
    });

    // Process video asynchronously (transcode + thumbnail)
    this.processVideo(video.id, filepath).catch((err) => {
      this.logger.error(`Video processing failed for ${video.id}: ${err.message}`);
    });

    return video;
  }

  // ─── UPDATE VIDEO METADATA ─────────────────────────────────────────────────

  async update(videoId: string, companyId: string, dto: UpdateVideoDto) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, companyId: true, status: true },
    });

    if (!video) {
      throw new NotFoundException('Video nicht gefunden');
    }

    if (video.companyId !== companyId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    if (video.status === 'DELETED') {
      throw new NotFoundException('Video nicht gefunden');
    }

    return this.prisma.video.update({
      where: { id: videoId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.jobPostId !== undefined && { jobPostId: dto.jobPostId }),
        ...(dto.professionId !== undefined && {
          professionId: dto.professionId,
        }),
        ...(dto.videoType !== undefined && { videoType: dto.videoType }),
        ...(dto.featuredPerson !== undefined && {
          featuredPerson: dto.featuredPerson,
        }),
      },
      include: {
        profession: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });
  }

  // ─── REMOVE VIDEO (SOFT DELETE) ─────────────────────────────────────────────

  async remove(videoId: string, companyId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, companyId: true, status: true, storagePath: true },
    });

    if (!video) {
      throw new NotFoundException('Video nicht gefunden');
    }

    if (video.companyId !== companyId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    await this.prisma.video.update({
      where: { id: videoId },
      data: { status: 'DELETED' },
    });

    // Delete from BunnyCDN (fire-and-forget)
    if (video.storagePath && this.bunnyStorage.isConfigured) {
      const thumbPath = video.storagePath.replace('/videos/', '/thumbnails/').replace('.mp4', '.jpg');
      this.bunnyStorage.deleteFile(video.storagePath).catch(() => {});
      this.bunnyStorage.deleteFile(thumbPath).catch(() => {});
    }

    return { success: true };
  }

  // ─── VIDEO PROCESSING (FFmpeg) ──────────────────────────────────────────────

  private async processVideo(videoId: string, originalPath: string) {
    const absolutePath = path.join(this.uploadDir, originalPath);
    const dir = path.dirname(absolutePath);
    const ext = path.extname(absolutePath);
    const base = path.basename(absolutePath, ext);
    const processedPath = path.join(dir, `${base}_processed.mp4`);

    // Thumbnail directory
    const thumbDir = path.join(this.uploadDir, 'thumbnails');
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }
    const thumbnailPath = path.join(thumbDir, `${videoId}.jpg`);

    try {
      // 1. Get video duration with ffprobe
      let durationSeconds: number | null = null;
      try {
        const { stdout } = await execFileAsync('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          absolutePath,
        ]);
        durationSeconds = Math.round(parseFloat(stdout.trim()));
      } catch {
        this.logger.warn(`Could not get duration for video ${videoId}`);
      }

      // 2. Transcode to MP4/H.264 (720p, capped at 2Mbps, AAC audio)
      await execFileAsync('ffmpeg', [
        '-i', absolutePath,
        '-vf', 'scale=-2:720',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-b:v', '2M',
        '-maxrate', '2M',
        '-bufsize', '4M',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        processedPath,
      ], { timeout: 300000 }); // 5 min timeout

      // 3. Generate thumbnail at 1 second mark
      await execFileAsync('ffmpeg', [
        '-i', processedPath,
        '-ss', '00:00:01',
        '-vframes', '1',
        '-vf', 'scale=640:-2',
        '-q:v', '3',
        '-y',
        thumbnailPath,
      ], { timeout: 30000 });

      // 4. Replace original with processed file
      const processedSize = fs.statSync(processedPath).size;
      fs.renameSync(processedPath, absolutePath);

      // 5. Upload to BunnyCDN (if configured)
      let cdnVideoUrl: string | null = null;
      let cdnThumbUrl: string | null = null;
      let bunnyVideoPath: string | null = null;
      let bunnyThumbPath: string | null = null;

      if (this.bunnyStorage.isConfigured) {
        try {
          // Extract companyId from the original path: /videos/{companyId}/{uuid}.ext
          const pathParts = originalPath.replace(/^\//, '').split('/');
          const companyId = pathParts[1]; // videos / {companyId} / {file}

          bunnyVideoPath = `companies/${companyId}/videos/${videoId}.mp4`;
          bunnyThumbPath = `companies/${companyId}/thumbnails/${videoId}.jpg`;

          cdnVideoUrl = await this.bunnyStorage.uploadFile(absolutePath, bunnyVideoPath);
          this.logger.log(`Video ${videoId} uploaded to BunnyCDN: ${bunnyVideoPath}`);

          if (fs.existsSync(thumbnailPath)) {
            cdnThumbUrl = await this.bunnyStorage.uploadFile(thumbnailPath, bunnyThumbPath);
            this.logger.log(`Thumbnail ${videoId} uploaded to BunnyCDN: ${bunnyThumbPath}`);
          }

          // Delete local files after successful CDN upload
          if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
          if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
        } catch (cdnErr) {
          this.logger.error(`BunnyCDN upload failed for ${videoId}, keeping local files: ${cdnErr.message}`);
          cdnVideoUrl = null;
          cdnThumbUrl = null;
          bunnyVideoPath = null;
          bunnyThumbPath = null;
        }
      }

      // 6. Update DB record
      await this.prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'ACTIVE',
          publishedAt: new Date(),
          filesize: processedSize,
          mimeType: 'video/mp4',
          filepath: cdnVideoUrl || originalPath,
          thumbnailPath: cdnThumbUrl || `thumbnails/${videoId}.jpg`,
          storagePath: bunnyVideoPath,
          ...(durationSeconds != null && { durationSeconds }),
        },
      });

      this.logger.log(`Video ${videoId} processed successfully${cdnVideoUrl ? ' (BunnyCDN)' : ' (lokal)'})`);
    } catch (err) {
      // Clean up partial files
      if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);

      await this.prisma.video.update({
        where: { id: videoId },
        data: { status: 'REJECTED', moderationNote: 'Videoprocessing fehlgeschlagen' },
      });

      throw err;
    }
  }
}
